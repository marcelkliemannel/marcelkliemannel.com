---
title: "Cross-Site Request Forgery (CSRF/XSRF) Protection in Quarkus"
date: 2021-09-25T11:51:05+02:00
draft: false
tags: ["Quarkus"]
summary: "Implementation strategies for the \"synchronizer token\", \"cookie-to-header token\" and \"double submit cookie\" pattern to prevent CSRF attacks in Quarkus."
---

[Cross-site request forgery (CSRF/XSRF)](https://owasp.org/www-community/attacks/csrf) is an attack technique that an attacker uses to trick a victim into unintentionally execute a malicious request to a server.

A CSRF vulnerability often arises from the false assumption that simply authenticating a user is sufficient to trust their requests. The consequence is that the CSRF attack regularly appears in the OWASP top 10 most common vulnerabilities. And its impact depends on the victim's privileges: these can range from changing address data such as the email to administrative configuration of a web.

The starting point of this attack could be a fake website that looks very similar to the original one. Or a malicious link or graphic in a spam email.

For example, let's assume a user logs into our website. The server sent a `JSESSIONID` cookie with the user's session ID as a response to that. Now the user visits the attacker website `melicious-site.com`, which response with malicious JavaScript code. The code will execute a POST request to the endpoint `/change-mail`, which will change the logged-in user's mail address to a value desired by the attacker. The problem now is that if a browser requests domain X, he will always send all cookies. However, it does not distinguish from where this request gets executed. And since the JavaScript code and thus the request gets executed in the user's browser, the browser includes the valid session ID cookie into the malicious request:

{{< retina-image csrf-attack2x.png "CSRF Attack Example" >}}

The protection against CSRF attacks is the use of **CSRF tokens** (better: anti-CSRF tokens). Unfortunately, Quarkus does not have any built-in functionality for this so far. Therefore, in this article, we will look at various implementation strategies in Quarkus.

## Discussion of Implementation Strategies

Our goal is that we want to distinguish legitimate requests from those of a malicious website. The solution to this is to require an unpredictable CSRF token with each request which is unique for the request or user session. 

There are different strategies to implement CSRF protection with tokens. All of them have their advantages and disadvantages. And which one to choose depends mainly on what kind of HTTP interfaces should be protected. So let's first get a brief overview of these strategies before discussing how we implement them in Quarkus in the following chapters.

### Synchronizer Token Pattern

For this pattern, a CSRF token gets generated per request or user session and it gets store on the server. We now send this token in the response to a requester and expect him to send it again with his subsequent request. Thus, we only have to check if the received token matches the stored one. The classic example for this is a HTML form in which the CSRF token gets embedded into a hidden field:

```html
<form action="/transfer" method="POST">
  <input type="hidden" name="csrf-token" value="400267aa-b875-4719-9cd6-7bb2833b70a5">
  ...
</form>
```

#### Advantages

- In general, this pattern is considered the safest solution, as we can verify through the server state that the token received is the one we issued.

#### Disadvantages

- We need to hold a state on the server.
- The [same-domain policy](https://www.hackedu.com/blog/same-origin-policy-and-cross-origin-resource-sharing-cors) must be correctly be configured on the server-side not to respond to GET requests from malicious websites. Without this, the protection from this pattern would not work.
- If we already have a session on the server, it should be no problem to store another value in the session object. However, we must also consider situations where we may not have a session, but a requester can still change the state on the server.
- Requiring a unique CSRF token per request does not bring any security advantages and rather leads to user experience disadvantages (see discussion on [this Information Security Stack Exchange question](https://security.stackexchange.com/questions/22903/why-refresh-csrf-token-per-form-request)). For example, it is a problem when the user uses the browser's back function, and the browser loads the previous page from the cache. If this page contains an HTML form with a CSRF token, it may have already been overwritten and is invalid when the old form gets submitted.

### Cookie-to-Header Token Pattern

For this pattern, the server provides the CSRF token via a cookie. The requester now reads the token from this cookie (e.g., via JavaScript), and with the subsequent request, he sends the token back in an HTTP header together with the original cookie. And for the CSRF protection, we just need to check on the server-side if both values match:

{{< retina-image cookie-to-header2x.png "Cookie-to-Header Example" >}}

This strategy works because JavaScript running on domain X is only allowed to read cookies from domain X. If a malicious website now sends a request to our domain, the browser will send the cookie. But, the JavaScript on the malicious website cannot provide the correct header value because it has no access to the cookie.

#### Advantages

- Does not require a state on the server.
- This pattern has built-in supported by many JavaScript frontend frameworks, for example, [AngularJS](https://angular.io/guide/http#security-xsrf-protection). We only need to provide the server side, and the protection will work automatically on client side.

#### Disadvantages

- A potential vulnerability lurks in the fact that sub domains can set cookies for parent domains. Therefore, in addition to our website, we must also ensure that all subdomain websites do not have any security issues through which it is possible to set/modify a cookie.
- Even though we only provide our website via HTTPS, there is still the possibility for an attacker to change the cookie value by using a man-in-the-middle-attack (see answers on [this Information Security Stack Exchange question](https://security.stackexchange.com/questions/59470/double-submit-cookies-vulnerabilities) for a description of this attack). To prevent this attack vector, additional security measures are required, such as [HTTP Strict Transport Security](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html).

We can also make this pattern stateful, just like the synchronizer token pattern, to have an additional security layer.

### Double Submit Cookie Pattern

This pattern works in principle like the cookie-to-header pattern, except that the requester can transmit the CSRF token from the cookie in other ways. The CSRF token is then sent once as a cookie and once, for example, in a hidden field in a form (see the synchronizer token pattern example). This pattern gets chosen when we want stateless validation, but no JavaScript is involved. However, the same disadvantages from the previous chapter remain.

## Implementation of the Synchronizer Token Pattern in Quarkus

### Generating and Storing the CSRF Token

For the following implementation, we need session management that can handle sessions for both logged-in and non-logged-in users. Luckily for us, Quarkus, in combination with the Undertow extension, offers us everything out of the box:

```xml
// Maven pom.xml
<dependency>
  <groupId>io.quarkus</groupId>
  <artifactId>quarkus-undertow</artifactId>
</dependency>

// Gradle build.gradle
implementation 'io.quarkus:quarkus-undertow'
```

Undertow identifies a session by a session ID in the cookie `JSESSIONID`. For real users, Undertow generates the session after login-in. For non-logged-in users, the session gets generated if a bean with the annotation [@SessionScoped](https://marcelkliemannel.com/articles/2021/overview-of-bean-scopes-in-quarkus/#sessionscoped) gets instantiated in the request chain. And to store our CSRF token in a session, we just have to create such an annotated bean:

```java
@SessionScoped
public class CsrfToken {
  
  private final String value = UUID.randomUUID().toString();

  String value() {
    return value;
  }
}
```

As long as the session is alive and Undertow can associate a request with an existent session, we can access the generated CSRF token again.

### Providing the CSRF Token

Now that we can generate a CSRF token and store it, we need to provide it to a requester. The concrete implementation for this depends on our HTTP endpoints. We can access the current CSRF token by injecting the `CsrfToken` type into a field in a JAX-RS resource or servlet and then deliver it along with the response.

For the HTML content of a contact form page, a solution might look like this:

```java
@Path("/contact")
public class ContactPage {

  @Inject
  CsrfToken csrfToken;

  @GET
  @Produces(MediaType.TEXT_HTML)
  public String getContactForm() {
    return "<form action="/contact" method="POST">" +
           "<input type=\"hidden\" name=\"csrf-token\" value=\"" + csrfToken.value() + "\">" +
           ...
           "</form>";
  }
}
```

However, we could also provide a central HTTP endpoint that issues the current CSRF token. This way is well suited for REST APIs, for example. The requestor would first have to get a token and can then make his state-changing requests. A sample implementation in which the token gets returned as a header might look like this:

```java
@Path("/csrf-token-issuer")
public class CsrfTokenIssuer {

  @Inject
  CsrfToken csrfToken;

  @GET
  public Response getCsrfToken() {
    return Response.ok().header("X-CSRF-TOKEN", csrfToken.value()).build();
  }
}
```

### Validating the Received CSRF Token

How exactly we check the validity of the received CSRF token depends on how we originally issued it.

For the contact form example, we would read the received token from the form fields and match it with the expected one:

```java
@Path("/contact")
public class ContactPage {

  @Inject
  CsrfToken csrfToken;
  
  ...
    
  @POST
  public void postContactForm(@FormParam("csrf-token") String csrfTokenFormParam) {
    if (csrfTokenFormParam == null || !csrfToken.value().equals(csrfTokenFormParam)) {
      throw new BadRequestException("Invalid or no CSRF token provided.");
    }
  }
}
```

For the token issuer implementation, a global filter is suitable that checks all requests that are not considered "secure" (HTTP methods GET and HEAD) for the presence and validity of the CSRF token header value:

```java
@Provider
public class CsrfTokenValidationFilter implements ContainerRequestFilter {

  private static final String CSRF_TOKEN_HEADER_NAME = "X-XSRF-TOKEN";

  private static final Response INVALID_CSRF_TOKEN_RESPONSE = Response.status(Response.Status.BAD_REQUEST)
    .entity("A valid CSRF token must be provided via the unambiguous header field: " + CSRF_TOKEN_HEADER_NAME)
    .build();
  
  @Inject
  CsrfToken csrfToken;

  @Override
  public void filter(ContainerRequestContext requestContext) {
    // No check for "secure" HTTP methods
    if (SECURE_HTTP_METHODS.contains(requestContext.getMethod())) {
      return;
    }

    List<String> csrfTokenHeader = requestContext.getHeaders().get(CSRF_TOKEN_HEADER_NAME);

    // Check if the CSRF token header is present and is has an 
    // unambiguous value, and the value matches the expected token.
    if (csrfTokenHeader == null
        || csrfTokenHeader.size() != 1 
        || !this.csrfToken.value().equals(csrfTokenHeader.get(0))) {
      
      requestContext.abortWith(INVALID_CSRF_TOKEN_RESPONSE);
      return;
    }
  }
}
```

(We could debate whether a 400 (Bad Request) or 403 (Forbidden) would be more appropriate in case of an error.)

## Implementation of the Cookie-to-Header Token Pattern

In the following we will look at a completely stateless implementation or the cookie-to-header token pattern. However, combining this with the stateful `CsrfToken` from the previous chapter and the Undertow session management is straightforward and would add another security layer.

### Issuing the CSRF Token by Setting a Cookie

The CSRF token for this pattern gets issued via a response filter. This filter inserts a random CSRF token cookie into the response if the request does not already have one:

```java
@Provider
public class CsrfTokenIssuerFilter implements ContainerResponseFilter {

  private static final String CSRF_TOKEN_COOKIE_NAME = "X-CSRF-TOKEN";

  @Override
  public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    // Check if cookie already exists
    if (requestContext.getCookies().containsKey(CSRF_TOKEN_COOKIE_NAME)) {
      return;
    }

    // Issue a new token
    String randomToken = UUID.randomUUID().toString();
    var tokenCookie = new NewCookie(CSRF_TOKEN_COOKIE_NAME, randomToken, "/", null, null, -1, true, false);
    responseContext.getHeaders().add("Set-Cookie", tokenCookie);
  }
}
```

The cookie created must meet the following requirements:

- The `httpOnly` flag must be set to `false`. Otherwise JavaScript frameworks would not be able to read the cookie and put it into a HTTP header.
- The domain must be set to `null` to meet the same-domain policy. So that the cookie can only be read from JavaScript running on the same domain (excluding sub domains).
- The `secure` flag must be `true`  to ensure that the cookie is only transferred over HTTPS connections.

### Validating the Received CSRF Token Cookie and Header

The validation for this pattern is also done by a filter, this time in a request filter. This filter checks for all requests that are not considered "secure" (HTTP methods GET and HEAD) that CSRF tokens are present in both the header and cookie, that they are identical, and that the token has a minimum length:

```java
@Provider
public class CsrfTokenValidationFilter implements ContainerRequestFilter {
  
  // Both names matching the AngularJS specification
  private static final String CSRF_TOKEN_HEADER_NAME = "X-XSRF-TOKEN";
  private static final String CSRF_TOKEN_COOKIE_NAME = "XSRF-TOKEN";
  
  private static final Response INVALID_CSRF_TOKEN_RESPONSE = Response.status(Response.Status.BAD_REQUEST)
    .entity("A valid CSRF token must be provided via the unambiguous header field: " + CSRF_TOKEN_HEADER_NAME + " and cookie: " + CSRF_TOKEN_COOKIE_NAME)
    .build();
  
  @Override
  public void filter(ContainerRequestContext requestContext) {
    // No check for "secure" HTTP methods
    if (SECURE_HTTP_METHODS.contains(requestContext.getMethod())) {
      return;
    }
    
    Cookie csrfTokenCookie = requestContext.getCookies().get(CSRF_TOKEN_COOKIE_NAME);
    List<String> csrfTokenHeader = requestContext.getHeaders().get(CSRF_TOKEN_HEADER_NAME);

    // Check if the CSRF token header and cookie is present, 
    // the header has an unambiguous value and both values
    // must match.
    if (csrfTokenCookie == null || csrfTokenHeader == null
            || csrfTokenHeader.size() != 1
            || !csrfTokenHeader.get(0).equals(csrfTokenCookie.getValue())) {
      
      requestContext.abortWith(CSRF_TOKEN_COOKIE_MISSING_RESPONSE);
      return;
    }
  }
}
```

(It could also be helpful to further specify the error message depending on the error case.)

### Safety of the CSRF Token

The presented solution for the cookie-to-header token pattern has one drawback: It allows in principle a requester to send any text as CSRF token as long as it is the same in header and cookie. We do not ensure that it is the initially issued token and meets the unique random value requirement.

Since we don't want to hold a state on the server, one solution is to sign the token we issue. For this, we create an application-scoped `CsrfTokenService`, which has a random global secret:

```java
@ApplicationScoped
public class CsrfTokenService {
  
  private static final byte TOKEN_BYTES = 16;
  private static final byte SIGNATURE_BYTES = 32; // Length of SHA-256

  private final SecureRandom secureRandom;
  private final byte[] secret = new byte[TOKEN_BYTES];

  private CsrfTokenService() throws NoSuchAlgorithmException {
    secureRandom = SecureRandom.getInstanceStrong();
    secureRandom.nextBytes(secret);
  }
  
  ...
}
```

This service gets a method that generates a random token. The token is a concatenation of the plain token and the signature of the token. And the signature is the SHA-256 value from the concatenation of the plain token and our global secret. In the end, the full value will be Base64 encoded so that we can put it into a cookie and header:

```java
public String createRandomToken() {
  try {
    byte[] tokenAndSignature = new byte[TOKEN_BYTES + SIGNATURE_BYTES];
    // Add random token
    secureRandom.nextBytes(tokenAndSignature);

    MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
    messageDigest.update(tokenAndSignature, 0, TOKEN_BYTES);
    messageDigest.update(secret);
    // Add signature
    messageDigest.digest(tokenAndSignature, TOKEN_BYTES, SIGNATURE_BYTES);

    return Base64.getEncoder().encodeToString(tokenAndSignature);
  }
  catch (NoSuchAlgorithmException | DigestException e) {
    throw new IllegalStateException(e);
  }
}
```

We can now inject the service into the `CsrfTokenIssuerFilter` and obtain the random token from it:

```java
@Provider
public class CsrfTokenIssuerFilter implements ContainerResponseFilter {
  ...
    
  @Inject
  CsrfTokenService csrfTokenService;

  @Override
  public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    String randomToken = csrfTokenService.createRandomToken()
    ...
  }
}
```

In the other direction for validation, we need to encode the received Base64 concatenation from token and signature first. We now take the blank token and use the global secret to compute the SHA-256 signature again. The resulting value is the expected signature. We now only have to match this with the received one and can thus validate whether this is one that we initially issued:

```java
public boolean validateToken(String encodedTokenAndSignature) {
  try {
    byte[] tokenAndSignature = Base64.getDecoder().decode(encodedTokenAndSignature);

    MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
    // Read only the plain token part
    messageDigest.update(tokenAndSignature, 0, TOKEN_BYTES);
    messageDigest.update(secret);
    byte[] expectedSignature = messageDigest.digest();

    // Compare actual signature with the expected one
    return Arrays.equals(tokenAndSignature, TOKEN_BYTES, TOKEN_BYTES + SIGNATURE_BYTES, expectedSignature, 0, SIGNATURE_BYTES);
  }
  catch (NoSuchAlgorithmException e) {
    throw new IllegalStateException(e);
  }
}
```

Likewise, we need to inject the service into the `CsrfTokenValidationFilter` and can then add the token validation to the existing validation chain: 

```java
@Provider
public class CsrfTokenValidationFilter implements ContainerRequestFilter {
  ...
    
  @Inject
  CsrfTokenService csrfTokenService;

  @Override
  public void filter(ContainerRequestContext requestContext) {
    ...
    if (... 
         || !csrfTokenService.validateToken(csrfTokenHeader.get(0))) {
      ...
    }
  }
}
```

## Implementation of the Double Submit Cookie Pattern

Implementing the double submits cookie pattern is a modification of the cookie-to-header pattern (see the previous chapter) with elements of the synchronizer token pattern.

We continue to use the `CsrfTokenIssuerFilter` from the cookie-to-header pattern to store the token in a cookie.

The token is then submitted a second time via a path to trigger an action on the server. For example, this could be the hidden field in HTML from the sample `ContactPage` in [the synchronizer token pattern](#providing-the-csrf-token) chapter. The validation of both tokens depends then likewise on where we expect the second token. Accordingly, the resource method from the contact page example looks modified for the validation as follows:

```java
@Path("/contact")
public class ContactPage {

  @Inject
  CsrfToken csrfToken;
  
  ...
    
  @POST
  public void postContactForm(@FormParam("csrf-token") String csrfTokenFormParam, @CookieParam("XSRF-TOKEN") Cookie csrfTokenCookie) {
    if (csrfTokenCookie == null || csrfTokenFormParam = null
        || !csrfTokenFormParam.equals(csrfTokenCookie.getValue()) || !csrfToken.value().equals(csrfToken)) {
      throw new BadRequestException("Invalid or no CSRF token provided.");
    }
  }
}
```

## Remarks

### Secure All Security Relevant HTTP Endpoints

A common mistake in the synchronizer token pattern is using CSRF protection only for actual user sessions but not with guest users. The justification for this is that guests can often only perform state-changing actions that have no security relevance. However, the login action, which gets executed by a gust user, is often overlooked. But this action has very high-security relevance.

### Token Randomness

It is crucial that the token is sufficiently long, is unique, and has strong randomness. For the length, the [OWASP](https://owasp.org/www-community/vulnerabilities/Insufficient_Session-ID_Length) recommends a minimum of 16 bytes (128 bits). For the strong randomness criteria, we used in this article the [UUID](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/UUID.html) and the [SecureRandom](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/security/SecureRandom.html) implementation. Both are very well suited for this purpose. What is not acceptable, however, are random numbers from the [Random](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Random.html) class.

### Secure HTTP Methods

We used the term "secure" HTTP methods several times in the implementations and said that we don't need to care about them. However, this assumption presupposes that we implemented all our HTTP API correctly. So, for example, a GET request does never cause a status change on the server. 