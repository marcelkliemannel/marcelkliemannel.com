---
title: "Centralized Error Response Handling and a Custom Error Page in Quarkus"
date: 2021-11-02T20:56:33+02:00
draft: false
tags: ["Quarkus"]
summary: "This article presents an implementation strategy to create a custom JSON, HTML, or text error page, via a centralized error response handling in an exception mapper or a response filter."
---

If we use Quarkus in the productive profile in conjunction with RESTEasy and call a URL that results in a 404 error (Not Found), we get the following HTML error page:

> RESTEASY003210: Could not find resource for full path: http://localhost:8080/assets/foo.txt

First of all, this page is problematic from a security point of view: By displaying the prefix "RESTEASY003210" we reveal the used web framework (see [OSWASP - WSTG-INFO-08](https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/01-Information_Gathering/08-Fingerprint_Web_Application_Framework)). Moreover by providing the full URL we possibly disclose sensitive information, e.g., the internal port if Quarkus is running behind a reverse proxy (see [OSWASP - WSTG-INFO-10](https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/01-Information_Gathering/10-Map_Application_Architecture)).

Furthermore, this error page is not ideal from an API design and a user experience point of view. For instance, if we have a JSON API, it should not return HTML content in case of error but a parsable JSON error object. And if we have a regular website, we would want the error page to be in the same design as our other pages.

Besides the classic 404 error page, we should also look at what our application returns in case of an uncaught exception. Normally, exceptions will be translated to a 500 error (Internet Server Error) and written to the log. However, this may not always be true, as there are certain exceptions that are thrown by parsing an invalid request. These should actually end in a 400 error (Bad Request).

This article will first look at how we can handle and modify error responses (responses with an HTTP status code greater than or equal to 400) in a centralized way in Quarkus. And after that, we create a custom error page fitting the media type from the `Accept` header of a request.

## Centralized Error Handling

There are two approaches to centralized error handling in Quarkus: a global exception mapper or a global response filter. Both have their advantages and disadvantages. Which of the two approaches we want to use or even combine the two depends on the desired result and our HTTP API implementation.

### Discussion of Implementation Strategies

With a global response filter, we can transform all error responses centrally. So, for example, we could wrap all errors into a JSON object. However, this approach has one disadvantage: we only see the blank error `Response` object in the filter, but its context is lost. To understand this, let's take a look at the following two resource methods, both would return the same error response:

```java
@GET
public Response failWithIndividualResponse() {
  return Response.status(Response.Status.NOT_FOUND)
                  .type(MediaType.TEXT_PLAIN_TYPE)
                  .entity("Error Message")
                  .build();
}

@GET
public Response failWithGenericResponse() {
  throw new NotFoundEception("Error Message");
}
```

In the first case, the implementation explicitly chose to return a text error message. In the second case, we say to the HTTP framework: set error status 404 with the following message, but we don't care how the error content gets presented. Later in a global response filter, we would no longer have this distinction if Quarkus decided to transform the exception into a text response. If we decide to create a global HTML error page, we would override the explicitly created text error response from the first method.

Suppose we want to make the distinction between explicit and implicit error responses in our application. In that case, it is more reasonable to do the global error handling completely via a global exception mapper. In this mapper, we would get the `NotFoundEception`, transform it arbitrarily, and leave explicitly set error responses as they are. However, we have the disadvantage in the exception mapper that only error responses triggered by an exception will come through.

Another issue to discuss is the logging of errors. We want to log all error responses with a status code equal to or greater than 500 as these indicate a problem that we need to fix, and pulling in as much context information as possible. Logging this information is only possible in a global exception mapper because we have the stack trace of the original exception. In the global response filter, we lost this information.

A exemplary implementation strategy could look like this:

- All HTTP resources should only work with exceptions in case of error. (It is possible to modify the response object in the standard `WebApplicationException`s via a parameter, e.g., to set header fields.)
- We use a global exception mapper:
  - to be able to map certain exceptions to a status code other than 500 and
  - to log internal server errors with more context information about the request.
- And we use a global response filter to transfer all errors into an error page that matches the `Accept` header of the requester.

### Global Exception Mapper

A global exception mapper implements the interface `javax.ws.rs.ext.ExceptionMapper` and uses the highest exception class to be handled as a type parameter. The method to be implemented gets the thrown exception as input and must return a `Response` object for the error:

```java
public class ErrorPageResponsEexceptionMapper implements ExceptionMapper<Exception> {
  
  @Inject
  javax.inject.Provider<ContainerRequestContext> containerRequestContextProvider;
  
  @Inject
  Logger logger;
  
  @Override
  public Response toResponse(Exception exception) {
    Response errorResponse = mapExceptionToResponse(exception);
    
    // Modify error response...
    
    return errorResponse;
  }
  
  private Response mapExceptionToResponse(Exception exception) {
    // Use response from WebApplicationException as they are
    if (exception instanceof WebApplicationException) {
      // Overwrite error message
      Response originalErrorResponse = ((WebApplicationException) exception).getResponse();
      return Response.fromResponse(originalErrorResponse)
                     .entity(originalErrorResponse.getStatusInfo().getReasonPhrase())
                     .build();
    }
    // Special mappings
    else if (exception instanceof IllegalArgumentException) {
      return Response.status(400).entity(exception.getMessage()).build();
    }
    // Use 500 (Internal Server Error) for all other
    else {
      logger.fatalf(exception,
                    "Failed to process request to: {}",
                    containerRequestContextProvider.get().getUriInfo());
      return Response.serverError().entity("Internal Server Error").build();
    }
  }
}
```

In the `mapExceptionToResponse()` implementation, we first map all subtypes of `WebApplicationException` (e.g., `FileNotFoundException`) to the `Response` instance which the exception already contains. But we overwrite the original error message with the name of the status code. This replacement is necessary to replace the problematic default error message of RESTEasy, as we discussed at the beginning of the article. Alternatively, we could work a bit more fine-grained here by overwriting only the messages that start with `RESTEASY`.

Next, we handle all exceptions for which we want to have a distinctive mapping. In the example, we would transform all `IllegalArgumentException` to a 400 error (Bad Request) and use the exception message as an error message.

We handle the standard case that leads to a 500 error (Internal Server Error) in the else block. First, we would return a generic error message here (so that no sensitive information gets disclosed). Second, we would log the exception plus some request information (the requested URL in this example).

### Global Error Response Filter

With a provider class that implements `javax.ws.rs.container.ContainerResponseFilter`, we can create a filter that modifies all responses going out from the server. In such a filter, we can change all error responses from a JAX-RS resource, servlet, or internal Quarkus code:

```java
@Provider
@Priority(9999)
public class ErrorPageResponseFilter implements ContainerResponseFilter {

  @Override
  public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    int status = responseContext.getStatus();
    if (status >= 400) {
      // Modify error response...
    }
  }
}
```

If we do not use an additional exception mapper, we still have to care for inappropriate error messages in the filter. As described at the beginning of this article, an error response should not disclose internal information. We could do this, for example, by always setting the body to the generic name of the status code:

```java
responseContext.setEntity(responseContext.getStatusInfo().getReasonPhrase());
```

Alternatively, as already described for the exception mapper, we could overwrite only the messages that begin with `RESTEASY`.

## Crafting a Media Type Dependent Error Page

In the previous chapter, we have seen how we can handle central error responses. One of the main reasons we would want to do this is to make the error response content type dependent on the [Accept](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept) header given by the requester, which tells us which [media type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types) he expects the content. Our goal now is to provide multiple error pages for different media types to respond with the best match for the expected one.

This chapter will first look at the implementation of JSON, HTML, and text error pages, and at the end, how we can include them in either the global exception mapper or response filter.

### Determine the Media Type

The following code allows us to determine the best matching media type for the error page based on the request:

```java
private static final List<MediaType> ERROR_MEDIA_TYPES = List.of(MediaType.TEXT_PLAIN_TYPE, MediaType.TEXT_HTML_TYPE, MediaType.APPLICATION_JSON_TYPE);
private static final MediaType DEFAULT_ERROR_MEDIA_TYPE = MediaType.TEXT_PLAIN_TYPE;

private MediaType determineErrorContentMediaType(ContainerRequestContext containerRequestContext)
  List<MediaType> acceptableMediaTypes = containerRequestContext.getAcceptableMediaTypes();
  MediaType bestMatch = MediaTypeHelper.getBestMatch(ERROR_MEDIA_TYPES, acceptableMediaTypes);
  return bestMatch != null ? bestMatch : DEFAULT_ERROR_MEDIA_TYPE;
}   
```

Let's go through this in detail:

- In line 1, we define all `MediaType`s we support, and in line 2, the default one which we will use as a fallback.
- In line 5, we read all `MediaType`s from the `Accept` headers of the request that the requester expects.
- In line 6, we try to find a match between the supported `MediaType`s and the expected ones.

(As an alternative to best matching, we could also consider setting only a status code if no one matches and not returning any content.)

### Create Media Type Dependend Content

After we have determined the type of our error page, we can create the type-dependent content:

```java
private String createErrorContent(MediaType errorMediaType, int errorStatus, String errorMessage) {
  // as JSON
  if (errorMediaType.equals(MediaType.APPLICATION_JSON_TYPE)) {
    return createJsonErrorContent(errorStatus, errorMessage);
  }
  // as HTML
  else if (errorMediaType.equals(MediaType.TEXT_HTML_TYPE)) {
    return createHtmlErrorContent(errorStatus, errorMessage);
  }
  // as text
  else if (errorMediaType.equals(MediaType.TEXT_PLAIN_TYPE)) {
    return createTextErrorContent(errorStatus, errorMessage);
  }
  else {
    throw new IllegalStateException("snh: Unexpected media type: " + errorMediaType);
  }
}
```

In the following three subsections, we will look at the implementations for each content type.

#### JSON Error Page

The JSON API specification [JSON:API](https://jsonapi.org/format/#errors) gives us a suitable format for a JSON error response. Based on the standard, we put the error into an object that should have a field `status`, which reflects the HTTP status code, and a field `title`, which contains a readable summary of the error. This object gets put into an array, which gets placed in an object under the field `errors`. The complete JSON response might look like this:

```json
{
  "errors": [
    {
      "status": 404,
      "title": "Not found"
    }
  ]
}
```

The idea behind aggregating multiple error objects in an array is to map more complex error cases. For example, when we are using [suppressed exceptions](/articles/2021/handling-multiple-thrown-exceptions-with-suppressed-exceptions/).

To generate such a JSON error response, we need the Quarkus RESTEasy Jackson extension, which allows us to generate JSON programmatically:

```xml
// Maven pom.xml
<dependency>
  <groupId>io.quarkus</groupId>
  <artifactId>quarkus-resteasy-jackson</artifactId>
</dependency>

// Gradle build.gradle.kts
implement("io.quarkus:quarkus-resteasy-jackson")
```

With the Jackson library, it's pretty easy to program our desired JSON structure. First, the structure gets filled with the error status code and message and finally transformed to a textual representation:

```java
@Inject
ObjectMapper objectMapper;

private String createJsonErrorContent(int errorStatus, String errorMessage) {
  ObjectNode errorObject = objectMapper.createObjectNode();
  errorObject.put("status", errorStatus);
  errorObject.put("title", errorMessage);
  
  ArrayNode errorsArray = objectMapper.createArrayNode().add(errorObject);
  
  return objectMapper.writeValueAsString(obj)
}
```

#### HTML Error Page

To create an HTML error page, we are using the [Qute templating engine](https://quarkus.io/guides/qute). For that, we need the Quarkus RESTEasy Qute extension:

```xml
// Maven pom.xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-resteasy-qute</artifactId>
</dependency>

// Gradle build.gradle.kts
implement("io.quarkus:quarkus-resteasy-qute")
```

The HTML error page itself is a simple HTML file that we put into the resource folder  `src/main/resources/templates` as `error.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error {errorStatus}</title>
</head>
<body>
  <h1>Error {errorStatus}</h1>
  <p>{errorMessage}</p>
</body>
</html>
```

In the file, we use the two placeholders `{errorStatus}` and `{errorMessage}`, which are dynamically replaced at runtime by Qute when rendering the final HTML code.

For the HTML error page generation, we are first injecting the template file, then replacing both placeholders, and finally rendering the result to a textual representation:

```java
@Inject
Template error;

private String createHtmlErrorContent(int errorStatus, String errorMessage) {
  return error.data("errorStatus", errorStatus)
              .data("errorMessage", errorMessage)
              .render();
}
```

#### Text Error Page

Last but not least, for the plain text error page generation, we are simply creating a String containing the error status and message:

```java
private static String createTextErrorContent(int errorStatus, String errorMessage) {
  return String.format("Error %d (%s)", errorStatus, errorMessage);
}
```

#### Error Page Generation

We now have everything to include the error page generation in either the global exception mapper or the global response filter.

In the **global exception mapper**, we use the response we generated from the exception mapping as the basis and use its HTTP status and message to generate the error content:

```java
public class ErrorPageResponsEexceptionMapper implements ExceptionMapper<Exception> {
 
  @Inject
  javax.inject.Provider<ContainerRequestContext> containerRequestContextProvider;
  
  ...

  @Override
  public Response toResponse(Exception exception) {
    Response errorResponse = mapExceptionToResponse(exception);
    
    MediaType errorMediaType = determineErrorContentMediaType(containerRequestContextProvider.get())
    String errorContent = createErrorContent(errorMediaType, errorResponse.getStatus(), errorResponse.getEntity().toString());
    
    return Response.fromResponse(errorResponse)
                   .type(errorMediaType)
                   .entity(errorContent)
                   .build();
  }

  ...
}
```

This way, all additional properties (e.g. headers) that we have set in `mapExceptionToResponse()` will also be taken over.

In the **global response filter**, we generate the error content based on the existing status code and message of the existing error response:

```java
public class ErrorPageResponseFilter implements ContainerResponseFilter {

  @Override
  public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    int status = responseContext.getStatus();
    if (status >= Response.Status.BAD_REQUEST.getStatusCode()) {
      MediaType errorMediaType = determineErrorContentMediaType(requestContext)
      String errorContent = createErrorContent(errorMediaType, responseContext.getStatus(), responseContext.getEntity().toString());
    
      responseContext.setEntity(errorContent, null, errorMediaType)
    }
  }
}
```

All the properties in the request chain remain in the response, as we only overwrite the body. It might be helpful to reset all previously set headers using `responseContext.getHeaders().clear()` to generate a consistent response. We must do this reset before the new body gets set because it will also set new headers.
