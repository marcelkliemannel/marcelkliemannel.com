---
title: "Routes Forwarding for JavaScript Frontends in Quarkus"
date: 2022-05-27T12:16:06+02:00
draft: false
tags: ["Quarkus"]
summary: "JavaScript singe-page application can mimic sub pages via an internal routing mechanism. For this feature to still work on a page reload, a filter must be implemeneted in a Quarkus backend which redirects certain 404 errors to the index page."
---

JavaScript frameworks like [Angular](https://angular.io/guide/routing-overview), [React](https://github.com/remix-run/react-router), and [Vue.js](https://vuejs.org/guide/scaling-up/routing.html) provide a mechanism called __routing__. With the help of this mechanism, single-page applications can have multiple subpages (e.g., `example.com/search` or `example.com/about`) without triggering a request to the server for each subpage (this functinallty is made possible by the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) of the browser).

It's easy to deliver a single-page website's resources (index.html, JS files, etc...) via Quarkus since it already has built-in functionality to [serve static resources](https://quarkus.io/guides/http-reference#serving-static-resources). However, there is one problem: if the user navigates to a subpage and refreshes the page, he will end up with a 404 error. The same problem arises if he wants to bookmark a particular subpage. This behavior is caused by the browser triggering an actual request to the server in both cases. But our Quarkus backend does not provide any endpoints for each subpage since they are a component of the frontend. The following sequence diagram shows the flow behind this issue:

![clientSideRoutingProblem](clientsiderouting_problem.svg#center)

There is a simple solution: Our Quarkus backend must use a filter which _internally_ forwards every 404 error to the index page, leading to a response with the status code 200 and our single-page application resources:

![clientSideRoutingForwarding](clientsiderouting_forwarding.svg#center)

In other words, we hand over the responsibility for 404 errors to the frontend framework.

The critical point here is that we have to do an internal forwarding, not a redirect. So that a request to `/about` would return the same response as a request to `/` (the index page). But the URL stays at the `/about` page. This behavior is essential for the routing mechanism of the JavaScript frontend to serve the subpage.

## Building an Internal Forwarding Filter

In this article, we will look at how we can archive the internal forwarding by implementing a response filter. First, we will look at a general skeleton of such a filter in this chapter, and then we will go into special cases in the following chapters.

Due to the modular design of Quarkus, there are many ways to implement the HTTP layer. This article will focus on the two common ways via the RESTEasy extension or the Undertow extension.

### JAX-RS Filter with the RESTEasy Extension

If we use the RESTEasy extension (`quarkus-resteasy`), we can implement a JAX-RS  `javax.ws.rs.container.ContainerResponseFilter`:

```java
@Provider
@Priority(Priorities.USER)
public class FrontendForwardingFilter implements ContainerResponseFilter {
  
  @Context
  HttpRequest httpRequest;

  @Context
  HttpResponse httpResponse;

  @Override
  public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    if (responseContext.getStatus() != 404) {
      return;
    }
    
    // Handling for special cases (see next chapters)
    // ...
    
    httpResponse.reset();
    httpResponse.setStatus(200);
    httpResponse.getOutputHeaders().add(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_HTML_TYPE);
    httpRequest.forward("/");
  }
}
```

Explanations:

- __Line 1:__ With the `@Provider` annotation, we make the filter discoverable.
- __Line 2__: We should choose the lowest possible priority for this filter so that other filters can run before this one. Note that `ContainerResponseFilter` are using a descending order.
- __Line 13__: We only want to handle 404 (Not Found) cases.

- __Line 20__: If another filter in the chain altered the response before use (e.g., added a header), we would reverse this by resetting the response object at this point.
- __Lines 21, 22__:  We explicitly set the stats code to 200 (OK) and the `Content-Type` header to HTML. (At least in Quarkus 2.9, setting both would not be needed, but this protects us against future changes.)
- __Line 23__: The final internal forwarding to the index resource.

### Java Servlet API Filter with the Undertow Extension

If our Quarkus application uses the Undertow Servlet extension (`quarkus-undertow`), we can implement a `javax.servlet.http.HttpFilter` from the Java Servlet API:

```java
@WebFilter("/*")
public class FrontendForwardingFilter extends HttpFilter {

  @Override
  protected void doFilter(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    super.doFilter(request, response, chain);
      
    if (response.getStatus() != 404) {
      return;
    }
    
    // Handling for special cases (see next chapters)
    // ...
    
    response.reset();
    response.setStatus(200);
    response.setContentType(MediaType.TEXT_HTML);
    request.getRequestDispatcher("/").forward(request, response);
  }
}
```

Explanations:

- __Line 1__: The filter becomes globally active for all paths using the URL pattern `/*`.
- __Line 8__: We only want to handle 404 (Not Found) cases.
- __Line 6__: A call the super method to execute all other filters and resources in the request chain. Our filter does not intercept requests to existing endpoints in our backend with this call.
- __Line 15__: If another filter in the chain altered the response before use (e.g., added a header), we would reverse this by resetting the response object at this point.
- __Lines 16, 17__: We explicitly set the stats code to 200 (OK) and the `Content-Type` header to HTML.
- __Line 18__: The final internal forwarding to the index resource.

## Special Cases to Handle

There are some cases where we should not blindly switch a 404 status code to a 200 and forwarding to the index page. Because our Quarkus application still acts as a backend with APIs and not just as a frontend deliverer.

### Excluding the API Namespace

It's common to structure all backend endpoints under one API namespace, for example, `/api/...`. This way, we would have a clean separation between the routes of the frontend application and the endpoints of the backend.

The API namespace is intended for machine-to-machine communication and not to be called directly by a user. Therefore, it would be rather disadvantageous not to respond with an actual 404 error from the backend level.

To exclude the API namespace, we first define a regular expression for both filter implementations that matches the API namespace:

```java
private static final String API_NAMESPACE_REGEX = "^/(api/.*|api)";
```

Then, we check if the request URI matches this regular expression. The request URI only contains the path but not the host or query parameter. So, for example, a request to `http://example.com/api/foo?version=2` would return the request URI `/api/foo`.

For the __JAX-RS filter__, checking if the regular expression matches the request URI would look as follows:

```java
public void filter(...) {
  ..
  boolean isApiNamespace = httpRequest.getUri().getPath().matches(API_NAMESPACE_REGEX);
  if (isApiNamespace) {
    return;
  }
  ...
}
```

And similar for the __Java Servlet API filter__:

```java
protected void doFilter(...) {
  ...
  boolean isApiNamespace = request.getRequestURI().matches(API_NAMESPACE_REGEX);
  if (isApiNamespace) {
    return;
  }
  ...
}
```

### Missing Static Resource Files

As for the API namespace, we should not shadow 404 errors if a non-existing static resource gets requested.

For both filter implementations, we first define a regular expression that matches filenames that have an extension (would match `/logo.png` but not `/logo`):

```java
private static final String FILENAME_REGEX = "^/.*\\.[^.]+$";
```

For the __JAX-RS filter__, checking the request URI for static resource files exclusion would look like follows:

```java
public void filter(...) {
  ..
  boolean isFilename = httpRequest.getUri().getPath().matches(FILENAME_REGEX);
  if (isFilename) {
    return;
  }
  ...
}
```

And similar for the __Java Servlet API filter__:

```java
protected void doFilter(...) {
  ...
  // Exclude requests to resource files
  boolean isFilename = request.getRequestURI().matches(FILENAME_REGEX);
  if (isFilename) {
    return;
  }
  ...
}
```

### Mixing Up Backend Endpoints and Frontend Routes

#### Actual 404 Errors

If we don't have a strict separation between frontend routes and API endpoints, we have to distinguish two types of 404 errors. The first type is a request to a non-existing endpoint (e.g., typos like `/bokks`). The second one is an explicitly generated 404 error from an existing endpoint because it does not find the requested entity (e.g., `/books/{isbn}` but there is no book with the given ISBN in the database).

To distinguish between these two cases, we have to check in our filters whether the 404 error was explicitly generated by a resource method or a servlet.

In the __JAX-RS filter__, we only need to check whether the `ResourceInfo` has a mapped resource method:

```java
@Context
ResourceInfo resourceInfo;

public void filter(...) {
  ...
  boolean actualErrorResponse = resourceInfo != null && resourceInfo.getResourceMethod() != null;
  if (actualErrorResponse) {
    return;
  }
  ...
}
```

And for the __Java Servlet API Filter__, we just need to check if there was an explicit servlet mapping:

```java
protected void doFilter(...) {
  ...
  boolean actualErrorResponse = !request.getHttpServletMapping().getMappingMatch().equals(MappingMatch.DEFAULT);
  if (actualErrorResponse) {
    return;
  }
  ...
}
```

#### Overlapping Paths

Another special case arises if we use the same path for a frontend route and a backend endpoint.

For example, suppose we have the frontend subpage `/books`. If a user is on that page and does a refresh, the browser makes a __GET__ request to the server, our filter should forward the 404 error to the index page, and the internal frontend routing will show the subpage again. But there is also a backend endpoint `/books`, which is only accessible with a __PUT__ request. In this case, the GET request would produce a 405 (Method Not Allowed) error instead of a 404 error, and thus our filter would not forward the frontend route. (This would be a lousy API design and should be solved by a separate API namespace.)

To manage such an overlapping case, we need to modify our filters' status code guard condition. The condition should handle GET requests that result in a 405 error, like a 404 error.

For the __JAX-RS filter__, the modification would look as follows:

```java
protected void doFilter(...) {
  int status = response.getStatus();
  if (status != 404 && !(status == 405 && "GET".equals(request.getMethod()))) {
    return;
  }
  ...
}
```

And for the __Java Servlet API filter__:

```java
public void filter(...) {
  int status = responseContext.getStatus();
  if (status != 404 && !(status == 405 && "GET".equals(requestContext.getMethod()))) {
    return;
  }
  ...
}
```
