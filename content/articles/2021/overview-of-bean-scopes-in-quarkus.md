---
title: "Overview of Bean Scopes in Quarkus"
date: 2021-08-26T15:33:50+02:00
draft: false
tags: ["Quarkus"]
metaDescription: "In-depth description about all bean scopes provided by Quarkus."
---

Beans are the centerpiece of a Quark's application. In contrast to a classically POJO class instance, the instance of a bean is encapsulated and lives inside a container object. Therefore beans are called container-managed. The container takes care of the lifecycle from the dependency resolution, the instantiation to the destruction of the bean. This container is called **client-proxy**.

A **scope** defines the behavior of a client-proxy. For example, this scope determines the exact times when the lifecycle of a bean starts and ends and when to reuse a bean instance or create a new one.

In this article, we will take a closer look at all the scopes that Quarkus offers.

## Background: Dependency Injection and Injection Points

Before we get into the scopes, we should first understand some of the essential terminologies for understanding the concepts around beans.

It all starts with the understanding of [**dependency injection (DI)**](https://en.wikipedia.org/wiki/Dependency_injection): A class that has a dependency on another class does not create an instance of that class itself. It just defines a dependency on the type of the class. The instance of the dependent class gets passed to the class at runtime from the outside.

The basis of Quarkus's **context and dependency injection framework (CDI)** is the [JSR 365](https://docs.jboss.org/cdi/spec/2.0/cdi-spec.html) specification. But we should note that Quarkus has not fully implanted this specification so far and has made optimizations in certain places.

Defining dependencies to other classes is done via so-called **injection points**. Such injection points are declared in the code by the annotation `@Inject`. In Quarkus, we have three ways to declare injection points:

A non-static **field** that is at least package-private and has the type of our dependent class:

```java {hl_lines=[5]}
@Path("/greeting")
public class GreetingResource {
  
  @Inject
  GreetingService greetingService;

  @GET
  @Produces(MediaType.TEXT_PLAIN)
  public String sayHello(@QueryParam("name") String name) {
    return greetingService.sayHello(name);
  }
}
```

A **constructor** that is at least package-private and has a parameter with the type of our dependent class (it is allowed to omit the `@Inject` annotation):

```java {hl_lines=[7]}
@Path("/greeting")
public class GreetingResource {
  
  private final GreetingService greetingService;
  
  @Inject
  GreetingResource(GreetingService greetingService) {
    this.greetingService = greetingService;
  }
  
  ...
}
```

A non-static **setter method**, that is at least package-private, returns `void` and has a parameter with the type of our dependent class:

```java {hl_lines=[7]}
@Path("/greeting")
public class GreetingResource {
      
  private GreetingService greetingService;
    
  @Inject 
  void setDeps(GreetingService greetingService) { 
    this.greetingService = greetingService;
  }
}
```

The question is now, which conditions the CDI mechanism used to create and reuse beans and how we can control them during the design process of our architecture.

## Short Overview of Quarkus Scopes

| Annotation                                                   | Initialization Time                                 | Instances                                                    |
| ------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------ |
| [@ApplicationScoped](https://docs.jboss.org/cdi/api/2.0/javax/enterprise/context/ApplicationScoped.html) | When a method on the injected instance gets called. | One per application.                                         |
| [@Singleton](https://jakarta.ee/specifications/platform/8/apidocs/javax/inject/singleton) | When injected into parent.                          | One per application.                                         |
| [@Dependent](https://docs.jboss.org/cdi/api/2.0/javax/enterprise/context/Dependent.html) | When injected into parent.                          | For every injection point.                                   |
| [@RequestScoped](https://docs.jboss.org/cdi/api/2.0/javax/enterprise/context/RequestScoped.html) | When a method on the injected instance gets called. | For every HTTP request.                                      |
| [@SessionScoped](https://docs.jboss.org/cdi/api/2.0/javax/enterprise/context/RequestScoped.html) | When a method on the injected instance gets called. | For every [undertow session](https://undertow.io/javadoc/1.3.x/io/undertow/server/session/Session.html). |
| Custome Scope                                                | Dependend on implementation.                        | Dependend on implementation.                                 |

## Application Wide Scopes

All application-wide scopes have in common that an instance of a bean class is created only once within an application. Therefore, the CDI will use the same instance at each injection point. This behavior corresponds to the classic singleton pattern and allows us to share a state across multiple injection points.

### @ApplicationScoped

**If a bean class has the annotation `@ApplicationScoped`, CDI will lazily instantiate the bean during the first call to a bean method.** But if the bean is never accessed, no instance will ever be created.

In the following example, we have a simple service annotated with `@ApplicationScoped`:

```java
@ApplicationScoped 
class MyApplicationScopedService {
  
  private int counter = 0;
  
  @PostConstruct
  void onConstructed() {
    System.out.println("@ApplicationScoped constructed");
  }
  
  int getAndIncrementCounter() {
    return counter++;
  }
}
```

This service holds a state with the `counter` field. Additionally, we can observe the life cycle with the post-construct listener `onConstructed()` and see when the bean gets initialized.

If we want to use the single instance of our `@ApplicationScoped` annotated service in other places of our application, we need to inject it via a field annotated with `@Inject` and has the type of the service. The field itself does not require any further instantiation. Quarkus's CDI will do that for us.

In the following startup listener bean, which is called as soon as the Quarkus application started, we are injecting two instances of our `@ApplicationScoped` annotated service:

```java
class ApplicationStartHandler {
  
  @Inject 
  MyApplicationScopedService firstMyApplicationScopedService;
  
  @Inject 
  MyApplicationScopedService secondMyApplicationScopedService;
    
  void onApplicationStart(@Observes StartupEvent e) {
    System.out.println("Application started");
    
    System.out.println(firstMyApplicationScopedService.getAndIncrementCounter()); // MyApplicationScopedService gets initzialisied now
    System.out.println(secondMyApplicationScopedService.getAndIncrementCounter());
  }
}
```

The execution of the application would give us the following output:

```
Application started
@ApplicationScoped onConstructed
0
1
```

We can now observe two things here: First, the creation of the instance gets deferred until we call `getAndIncrementCounter()` for the first time. If we would remove the two calls, we would only get the following output:

```
Application started
```

So the `MyApplicationScopedService` class was never instantiated.

Second, we see that we continuously operated on the same instance even though we used two different fields to access the service when incrementing the `counter` field. This behavior shows that the state gets shared between two injection points.

### @Singleton

Unlike @ApplicationScoped, **if a bean has the annotation `@Singleton`, it gets instantiated when injected into another bean.** But it is irrelevant whether the bean is ever accessed.

The following example shows a simple `@Singleton` service that has only one post-construction listener, with which we can observe when the CDI mechanism has created our instance:

```kotlin
@Singleton 
class MySingletonService {
  
  @PostConstruct
  void onConstructed() {
    System.out.println("@Singleton constructed");
  }
}
```

We now inject this `@Singleton` service into a field of the following startup listener, but without explicitly calling a method of the service bean instance:

```kotlin
class ApplicationStartHandler {
  
  @Inject 
  MySingletonService mySingletonService; // MySingletonService gets initzialisied now
  
  void onApplicationStart(@Observes StartupEvent e) {
    System.out.println("Application started");
  }
}
```

The execution of the application would result in the following output:

```
@Singleton constructed
Application started
```

Firstly, we can see that the instantiation of `MySingletonService` happened during the instantiation of `ApplicationStartHandler`, but before the invocation of the `onApplicationStart` method. And secondly, that the creation of the instance happened although we have never accessed it directly, unlike in the `@ApplicationScope` example from the previous chapter.

## @Dependent Scope

**If a bean has the annotation `@Dependent`, CDI will create a new instance at each injection point when it gets injected.** In contrast to the application-wide scopes, there is no shared state across multiple injection points.

The life cycle of such a bean depends on that of the parent bean into which it gets injected. For example, if the parent is a `@Singleton` bean, a `@Dependent` bean would exist as long as the application runs. But, on the other hand, if it is a `@RequestScoped` bean that exists only for a request (see next chapter), a `@Dependent` bean would also exist only for the request's scope.

The following `@Dependent` service holds a counter state field and has a post-constructed listener with which we can see when and how often the creation of our instance gets triggered:

```java
@Dependent 
class MyDependentService {
  
  private int counter = 0;
  
  @PostConstruct
  void onConstructed() {
    System.out.println("@Dependent constructed");
  }

  int getAndIncrementCounter() {
    return counter++;
  }
}
```

Analogous to the `@ApplicationScope` example, we inject the service twice into a startup listener, and icrement the `counter` field on both instances:

```java
class ApplicationStartHandler {
  
  @Inject 
  MyDependentService firstDependentService; // MyDependentService gets initzialisied now
  
  @Inject 
  MyDependentService secondDependentService; // MyDependentService gets initzialisied now
  
  void onApplicationStart(@Observes StartupEvent e) {
    System.out.println("Application started");
    
    System.out.println(firstDependentService.getAndIncrementCounter());
    System.out.println(secondDependentService.getAndIncrementCounter());
  }
}
```

Running the application will give us the following output:

```
@Dependent constructed
@Dependent constructed
Application started
0
0
```

On the one hand, we can see that CDI has created two separate instances at the moment of injection. And on the other hand, incrementing the `counter` field on the first instance did not affect the second one.

## @RequestScoped

**If a bean class has the annotation `@RequestScoped`, CDI will lazily instantiate the bean during the first call to a bean method. Such a bean lives only within a chain used to process a single HTTP request.** 

A request-scoped bean encapsulates information of a request and shares them through multiple injection points within the processing chain. Parts of this chain are, e.g., request/response filters, a JAX-RS method, or a classic servlet.

One of the most known request-scoped beans in Quarkus is the `io.vertx.core.http.HttpServerRequest`, which contains information about the called URI, or the HTTP headers of the current request.

In the following example, we want to implement a JAX-RS HTTP endpoint method that we can use to add two numbers. To make larger numbers more readable, we want to format the result using a decimal separator. However, the decimal separator character depends on the requester's region: It's a point in the USA, in other countries a comma. Therefore, for the requester to get the correct output, we give him the option to include the header `X-Locale` to specify his desired [Locale](https://docs.oracle.com/en/java/javase/16/docs/api/java.base/java/util/Locale.html) value.

To only have to compute this information once and make the code reusable for different purposes, we put the parsing of the header in a bean annotated with `@RequestScoped`:

```java
@RequestScoped
public class RequestUserContext {
  
  private final Locale locale;
  
  public RequestUserContext(HttpServerRequest request) {
    String localeHeader = request.headers().get("X-Locale");
    locale = localeHeader != null ? new Locale(localeHeader) : Locale.ENGLISH;
  }

  Locale getLocale() {
    return locale;
  }
}
```

Now we can create a JAX-RS resource where we inject the `RequestUserContext` bean. In the HTTP Endpoint method, where we add the two numbers passed as query parameters, we now have access to the `Locale` requested by the requester. We can then use this `Locale` in a `NumberFormat` that formats the final result with the desired decimal separator:

```java
@Path("/calculator/addition")
public class CalculatorAdditionResource {

  @Inject
  RequestUserContext requestLocale;

  @GET
  @Produces(MediaType.TEXT_PLAIN)
  public String plus(@QueryParam("a") int a, @QueryParam("b") int b) {
    NumberFormat numberFormat = NumberFormat.getNumberInstance(requestLocale.getLocale());
    return numberFormat.format(a + b);
  }
}
```

## @SessionScoped

**If a bean class has the annotation `@SessionScoped`, CDI will lazily instantiate the bean during the first call to a bean method. Such a bean lives till the associated session gets terminated.** Thus, unlike `@RequestScoped`, we can have a shared state in a session-scoped bean instance across multiple HTTP requests.

The session scope is only available if the undertow extension is enabled:

```
// Maven pom.xml
<dependency>
  <groupId>io.quarkus</groupId>
  <artifactId>quarkus-undertow</artifactId>
</dependency>

// Gradle build.gradle
implementation 'io.quarkus:quarkus-undertow'
```

What exactly is a session in this context? Suppose the Quarkus server is processing an HTTP request and there is at least one bean annotated with `@SessionScoped` injected in the request processing chain (see the previous chapter). In that case, the undertow [SessionManager](https://undertow.io/javadoc/1.3.x/io/undertow/server/session/SessionManager.html) will create a new session with a unique ID. This session is effectively the parent of the session scoped bean. As long as the session lives, the bean also exists. It gets deconstructed alongside the termination of the session.

The processed response of the server contains the session ID as the cookie `JSESSIONID`. Since HTTP is a stateless protocol, the requester must resend this session ID cookie with every request. If he does this, our session-scoped bean will get reused by CDI in the request processing chain. Otherwise, CDI will create a new instance of the bean.

We can use such a session scoped bean, for example, to remember the last queries in a search field. And offer them again to the user for selection when he revisits the page later.

Session scoped beans are not limited to anonymous sessions. We can also use them if we create an actual user session through one of the many [authentication paths](https://quarkus.io/guides/security) in Quarkus.

## Dynamically Scoped

We might find ourselves in the situation where we want to set the scope of a bean class at runtime dynamically. Or, we may want to use a class that comes from an external library as a bean. In both cases, we could not hard-code the scope annotation to the class. So-called **producer methods** are a solution to this problem.

In the following example, we define two producer methods, each creating an instance of `MyService`. If the "dev" profile is active, CDI will create a single application-scoped instance at runtime (the first method). However, if this is not the case, Quarkus would fall back to a method which annotated with `@DefaultBean` and, in our case, produces a request-scoped service (the second method):

```java
public class MyServiceProducer {
  
  @Produces 
  @ApplicationScoped 
  @IfBuildProfile("dev")
  public MyService createApplicationScopedService() {
    return new MyService();
  }

  @Produces
  @RequestScoped
  @DefaultBean
  public MyBean createRequestScopedService() {
    return new MyService();
  }
}
```

The same mechanism works for external classes as long as they are not `final`.

## Custom Scope

There is the possibility that we define custom scopes, which self-selected criteria. For example, when and how a bean gets created and reused at an injection point within such a scope.

But, custom scopes are a complex topic since we have to take care of the life cycle of a bean ourselves, which would go beyond the scope of this article. We will possibly take a deeper look in a future article. However, here is a brief list of all the steps we need to take to implement a custom scope:

1. First, we need a new annotation that identifies a class as a bean of our custom scope. This annotation must have the `RetentionPolicy` `RUNTIME` and be targeted to at last one of the `ElementType`s `TYPE`, `METHOD` or `FIELD`. And in order for this annotation to represent a scope, it needs either be annotated with `javax.inject.Scope` or `javax.enterprise.context.NormalScope`. (The JavaDoc of both contains a detailed explanation of scope annotations).
2. For the annotation, we need a logic that creates and manages the beans within the scope. For this, we need to [create a new Quarkus extension](https://quarkus.io/guides/writing-extensions). This new extension needs a dependency on the project that contains our custom scope annotation.
3. In the extension's runtime project, we must create a scope context class that implements `io.quarkus.arc.InjectableContext`. This class manages the life cycle of the beans inside our scope.
4. In the extension's deployment project, we would have to register our annotation together with the context. As an example, we can look at the method [buildCdiScopes()](https://github.com/adminfaces/quarkus-omnifaces/blob/f084509bc9cf44943b3470adbb8ab7de12aa6aaa/deployment/src/main/java/io/quarkus/omnifaces/deployment/OmniFacesProcessor.java#L55) in the OmniFaces Quarkus extension.

## Force Inizialization

Beans get instantiated either lazily if a bean method gets called or if the parent bean gets initialized. As a consequence, our bean may never get instantiated. But by registering our bean as an observer for specific events, we can force the instantiation.

By adding an observer method for the `StartupEvent`, the application start will initialize the bean at least once:

```java
@Singleton
class SingletonBean {
  void setup(@Observes StartupEvent event) {
    // Initialize bean...
  }
}
```

Alternatively, if we don't need a dedicated method, we can annotate the entire class with `@Startup`:

```java
@Startup
@Singleton
class SingletonBean {
}
```

If we want to react to the creation of a new `RequestScope` or `SessionScope`, we can also do this with an observer method:

```java
@RequestScoped // Or @SessionScoped
class SingletonBean {
  void setup(@Initialized(RequestContext.class) Object event) { // Or SessionContext.class
    // Initialize bean...
  }
}
```

However, we must consider the life cycle of scopes here. For example, this means for a bean annotated with `@Dependent`: The startup event will trigger the creation of an instance that gets immediately deconstructed after the execution of the startup method.

## Remarks

### Field Access Will Not Trigger the Instantiation of a Bean

At the definition of the `@ApplicationScoped`, `@RequestScoped` and `@SessionScoped` we should pay special attention to the condition "(...) CDI will lazily instantiate the bean during the first call to a bean method.". If we access only fields of the injected bean, the values are stored in the instance, but the instantiation (e.g., a `@PostConstruct` method or the constructor for injection points) is not executed.

### Unsupported CDI Scopes

Although Quarkus follows the CDI specification, it has not yet fully implemented it. The consequence of that is that the  `@ConversationScoped` annotation is not supported. However, we can represent most use cases of `@ConversationScoped` in Quarkus by using `@SessionScoped`.

### Injection Points are Just Proxy Instances

One of the fundamental understandings of beans is that we never work directly on the bean itself but always via a so-called client proxy instance. It is important to note that we cannot make any assumptions about this client proxy. Depending on the scope implementation, there may be only one client proxy instance for multiple bean instances. This client then forwards the field accesses or method calls to the correct bean internally. Therefore, the CDI specification ([5.4.1. Client proxy invocation](https://jakarta.ee/specifications/cdi/3.0/jakarta-cdi-spec-3.0.html#client_proxy_invocation)) states that the behavior of the methods from `java.lang.Object` (e.g., `equals()` and `hashCode()`) is undefined. Therefore we should not work with them.