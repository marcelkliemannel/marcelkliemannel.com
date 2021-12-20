---
title: "Migrating From Spring to Quarkus"
date: 2021-12-19T16:20:00+02:00
draft: false
tags: ["Quarkus"]
summary: "The best way to become familiar with Quarkus as a Spring developer is to look at what is required to migrate a Spring application to a Quarkus application. This way, we can build a deep understanding of the concepts and components of Quarkus."
---

Spring and Quarkus are Java application frameworks that serve as a foundation for complex, high-performance applications. Both frameworks use similar concepts (e.g., dependency injection) and offer a wide range of components for different areas of application development (data modeling, security, database connections, etc.).

This article aims to give a rough overview of the concepts and components of Quarkus from the perspective of a developer who is familiar with Spring. To achieve this, we want to elaborate on how we can migrate a Spring-based application into a similar Quarkus-based application.

## Architecture

The Spring platform consists of [22 projects](https://spring.io/projects) (Spring Framework, Security, Batch, etc.) and some [experimental projects](https://github.com/spring-projects-experimental), whereby the main Spring Framework project comprises [20 modules](https://docs.spring.io/spring-framework/docs/5.0.0.RC2/spring-framework-reference/overview.html#overview-modules) (for example, *web*). We get all other functions for our applications via ordinary third-party dependencies.

On the contrary, the Quarkus platform's structure is somewhat different. Because the architects of Quarkus are keen to ensure that the entire framework builds on existing standards, they made the core functionalities of the framework around well-known libraries. Therefore, Quarkus comes with much less framework-specific code.

Quarkus is at its core a reactive framework, which gets achieved through the event-driven library [Vert.x](https://vertx.io/). Regardless of what we do in our application, there is always a Vert.x instance running underneath us responsible for processing parallel tasks (such as the processing of an HTTP request).

### Extensions vs. Dependencies

Everything above the Vert.X core is provided by so-called **extensions**. On the one hand, these extensions cover the components that we know from the Spring platform. But also, and this is the remarkable thing about Quarkus, these also serve as "replacements" for ordinary third-party dependencies. For example, we would not use the normal dependency for the [Apache Camel library](https://camel.apache.org), as we would do in Spring, but the special [Camel Quarkus extension](https://camel.apache.org/camel-quarkus/2.5.x/index.html). (However, it is still possible to use standard third-party libraries.)

Why do we now need special extensions and not use the standard libraries? In Spring, as our application grows, we have the problem that the startup time increases significantly. During startup, Spring resolves all meta information and dependencies in our application code and libraries in the classpath. A central goal of Quarkus is to solve this problem and significantly reduce startup time. And besides that, to produce smaller artifacts and better native support for the GraalVM. To achieve these goals, Quarkus moves the resolving process, which Spring does at runtime, to the build time.

Therefore, an extension is an advanced library that contains [additional build time logic](https://quarkus.io/guides/writing-extensions#build-step-processors). With this logic, meta information and dependencies can be pre-calculated. Also, code generation, unused code removal, and creating caches/indexes can be done depending on the actual application configuration.

### Equivalents of Spring Components in Quarkus

The following table contains an incomplete mapping of most used Spring components to their Quarkus extension equivalents:

| Spring Component         | Quarkus Extension                                            |
| ------------------------ | ------------------------------------------------------------ |
| [web] Web                | [RESTEasy](https://mvnrepository.com/artifact/io.quarkus/quarkus-resteasy) |
| [web] Servlet            | [Undertow](https://mvnrepository.com/artifact/io.quarkus/quarkus-undertow) |
| [web] WebSocket          | [Websockets](https://quarkus.io/guides/websockets)           |
| [data] JPA               | [Panache](https://quarkus.io/guides/hibernate-orm-panache)                  |
| [data] Transactions      | [Narayana JTA](https://quarkus.io/guides/transaction)        |
| [data] JDBC              | [Built-in based on Agroal or Vert.X](https://quarkus.io/guides/datasource#jdbc-datasource-2) |
| [data] JDBC Data Sources | [JDBC datasources](https://quarkus.io/guides/datasource#jdbc-datasource-2) |
| [data] JMS               | [Built-in event bus of Vert.X](https://quarkus.io/guides/reactive-event-bus) or [Qpid JMS AMQP/ActiveMQ Artemis JMS](https://quarkus.io/guides/jms) |
| Spring GraphQL           | [SmallRye GraphQL](https://quarkus.io/guides/smallrye-graphql) |
| Spring Session           | [Undertow](https://mvnrepository.com/artifact/io.quarkus/quarkus-undertow) |
| [security] Kerberos      | [Quarkiverse: Kerberos](https://github.com/quarkiverse/quarkus-kerberos) |
| [security] OAuth         | [Elytron Security OAuth2](https://quarkus.io/guides/security-oauth2) |
| [security] JWT           | [SmallRye JWT](https://quarkus.io/guides/security-jwt)       |
| Spring LDAP              | [Elytron Security LDAP](https://quarkus.io/guides/security-ldap) |
| Spring Shell             | [Picocli](https://quarkus.io/guides/picocli)                 |
| Spring Cache             | [Quarkus Cache](https://quarkus.io/guides/cache#caching-annotations) |
| [cloud] AWS              | [Varity of extensions](https://quarkus.io/guides/#cloud)     |

Chapter [Migrating Spring Components]({{< ref "migrating-from-spring-to-quarkus.md#migrating-spring-components" >}}) shows an exemplary migration of Spring Web and Spring JPA to Quarkus.

### Reuse Spring Code

It is often impossible to start a greenfield application entirely based on Quarkus, its paradigms, and extensions. The Quarkus maintainers have therefore created several extensions that allow us to use Spring code in a Quarkus application:

- [Spring DI API extension](https://quarkus.io/guides/spring-di) Use of Spring annotations like `@Component` and `@Autowired` to define and inject beans.
- [Spring Web API extension](https://quarkus.io/guides/spring-web): Defining REST resources with Spring annotations like `@GetMapping`.
- [Spring JPA extension](https://quarkus.io/guides/spring-data-jpa): Defining Panache JPA respositories with Springs `Repository` (e.g., `CrudRepository`).
- [Spring Data REST extension](https://quarkus.io/guides/spring-data-rest)
- [Spring Security API extension](https://quarkus.io/guides/spring-security): Secure REST resources with Spring's `@Secured("roleName")` annotation.
- [Spring Cache API extension](https://quarkus.io/guides/spring-cache)
- [Spring Scheduling API extension](https://quarkus.io/guides/spring-scheduled)
- [Spring Boot Properties API extension](https://quarkus.io/guides/spring-boot-properties): Application properties via Spring's `@ConfigurationProperties` annotation.

## Build Tool Chain

Both Spring and Quarkus support Maven and Gradle and provide extra dependencies for better Kotlin support. Unlike Spring, however, [Quarkus does not yet support Groovy](https://github.com/quarkusio/quarkus/issues/2720).

### Maven

In a Sprint-Boot-based application, we can decide between inheriting from the parent POM file `spring-boot-starter-parent` or Spring's [Bill Of Materials (BOM) file](https://www.baeldung.com/spring-maven-bom). In Quarkus, there is only the BOM file, which we include as follows:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>io.quarkus.platform</groupId>
      <artifactId>quarkus-bom</artifactId>
      <version>2.5.0.Final</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
</dependencyManagement>
```

Except that the version gets provided via the BOM file, we can add all other Quarkus dependencies as typical Maven dependencies.

As in Spring, there is a Maven Quarkus plugin which takes care of the additional built-time processing as well as additional development and distribution tasks:

```xml
<plugin>
  <groupId>io.quarkus.platform</groupId>
  <artifactId>quarkus-maven-plugin</artifactId>
  <version>2.5.0.Final</version>
  <extensions>true</extensions>
  <executions>
    <execution>
      <goals>
        <goal>build</goal>
        <goal>generate-code</goal>
        <goal>generate-code-tests</goal>
      </goals>
    </execution>
  </executions>
</plugin>
```

### Gradle

In Gradle, the Quarkus framework works as in Spring. We have to apply one plugin that provides tasks for the build process as well as dependency management:

```kotlin
plugins {
  id("io.quarkus")
}
```

We then include further Quarkus dependencies via the standard Gradle dependencies configurations.

### Development Mode

Spring offers a [devtools](https://docs.spring.io/spring-boot/docs/1.3.8.RELEASE/reference/html/using-boot-devtools.html) plugin for Gradle and Maven, which allows us to run an application in development mode. One advantage of this mode is that it reacts to source file changes and automatically restarts the application or performs a [hot reload/swapping](https://docs.spring.io/spring-boot/docs/current/reference/html/howto.html#howto.hotswapping). To use the development mode, we need to start the application via `./mvnw compile quarkus:dev` (Maven) or `./gradlew quarkus:dev` (Gradle).

## Creating a Project From Scratch

With the [Spring Initializr](https://start.spring.io/) tool, we can click together a runnable skeleton of a Spring application (build environment, initial configuration, and dependencies). Quarkus offers a similar tool with the same functionality on [code.quarkus.io](https://code.quarkus.io/).

## Application Configuration

[Spring's application configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config) is nearly similar to [Quarkus' configuration system](https://quarkus.io/guides/config-reference). The runtime configuration is an aggregation of different configuration sources. The most well-known sources, which function identically in both frameworks, are:

- Environment variables (where `FOO_BAR` gets mapped to `foo.bar`);
- JVM system properties and
- a `META-INF/application.properties` file.

Quarkus uses the [SmallRye Config API](https://github.com/smallrye/smallrye-config), which implements the [MicroProfile Config specification](https://github.com/eclipse/microprofile-config). This API offers the possibility to implement custom configuration sources, [about which I wrote a more detailed article]({{< ref "custom-microprofile-configuration-sources-in-quarkus.md" >}}).

For the property value in Spring, we can use the [Spring Expression Language](https://www.baeldung.com/spring-expression-language), which allows us to execute logic to define the property's value. In Quarkus, this is more limited. Here we can only refer to other values with the Property Expression definition:

```properties
working-dir=sandbox
log-dir=${working-dir}/log
```

### Injecting Configuration Properties

In Spring, we would use the annotation `@Value("${propertyName}")` to inject a configuration property into a field, parameter, or setter method. In Quarkus, we use the annotation `@ConfigProperty("propertyName")`. Both frameworks can automatically map the property value to the data type of the injection point:

```java
@ConfigProperty("num-of-threads")
int numOfThreads;
```

Spring's `@Value` is more potent because of the expression language. While in Quarkus, we do a simple mapping of the given property name to its value (similar to reading a value from a map).

This difference can be seen in the handling of **default values**: we would use the expression `@Value("${propertyName:defaultValue}")` in Spring, but `@ConfigProperty(name = "propertyName", defaultValue = "defaultValue")` in Quarkus.

As in Spring, the application start will fail if a referenced property is not available. We reference **optional values** either by specifying a default value or wrapping the type in a Java `Optional<...>`.

### Profiles

A profile allows us to adapt our application to different runtime environments, such as mocked data in a development environment instead of the productive database. How profiles are defined, and work is almost identical in [Spring](https://www.baeldung.com/spring-profiles) and [Quarkus](https://quarkus.io/guides/config-reference#profiles).

An important point regarding profiles in Quarkus is that there is a difference between the _build time_ profile and the _runtime_ profile. The reason for that is that  Quarkus moves a lot of things into build time that Spring doesn't do until runtime.

Quarkus, like Spring, has the built-in profiles *prod*, *dev*, and *test.* The Quarkus framework, Maven plugin, or Gradle plugin will automatically choose the correct profile for build time and runtime, based on the current environment. For example, if we start Quarkus via the dev Maven/Gradle task, the plugin will select the *dev* profile for build and runtime. And the *prod* profile if we build the JAR of our application. We can configure the build time profile in the Maven or Gradle plugin and the runtime profile via the system property `-Dquarkus.profile=my-profile`.

The chapter [Creating Beans Depending on the Profile]({{< ref "migrating-from-spring-to-quarkus.md#creating-beans-depending-on-the-profile" >}}) will discuss how we can create beans depending on the profile.

#### Profile Dependent Configuration Properties

Quarkus uses the same naming schema for configuration properties files like Spring. The scheme is as follows: a property defined in file `application.properties` will be available in all profiles and defined in a file with the profile name as a postfix only in that profile. So, for example, all properties from file `application-dev.properties`  would only be available in the _dev_ profile.

In addition to that, in Quarkus, we can add the profile as a prefix to the property name. For normal properties, the format would be `%profileName.key=value` (e.g., `%dev.foo.bar=baz`) and for environment variables `_PROFILENAME_KEY=VALUE` (e.g., `_DEV_FOO_BAR=BAZ`). This mechanism makes it possible to define the same property key but for different profiles in one file.

## Main Class

Spring requires us to have a class with a main method. In contrast, such a [main method in Quarkus](https://quarkus.io/guides/lifecycle#the-main-method) is optional. Quarkus will generate a simple one for us at build time if we don't provide our own. Such a simple one looks like this:

```java
@QuarkusMain  
public class MyMain {

  public static void main(String ... args) {
    Quarkus.run(args); 
  }
}
```

The main class is found by Quarkus either by the annotation `@QuarkusMain` or by the fully qualified class name specified in the configuration property `quarkus.package.main-class`.

An explicit main class has the advantage that we can start Quarkus directly from our IDE and don't have to use Gradle or Maven. However, we then do not benefit from the development CLI.

## Spring's IoC Container vs Quarkus' ArC Container

Both [Spring](https://docs.spring.io/spring-framework/docs/5.3.x/reference/html/core.html#beans-introduction) and [Quarkus](https://quarkus.io/guides/cdi-reference) implement the inversion of control principle (IoC) using the dependency injection (DI) mechanism. In summary, with DI, an object only defines dependencies to other objects (for example, through constructor arguments, properties, or setter methods) but is not responsible for their instantiation. Instead, an object receives the instances of its dependent objects at runtime by a higher-level controller, the so-called *container*. This container is not only responsible for the DI. It also takes care of all aspects of the life cycle of an object. Such a controlled object gets called *a bean*.

Substantially, Spring and Quarkus don't differ much in how we work with the DI mechanism, how the container handles the lifecycles, and how we define beans. So for most use cases, in terms of DI, we only have to get used to new annotation names and slightly different default behavior of certain features.

Quarkus' DI solution (called ArC) is based on the standard [JSR 365: Contexts and Dependency Injection for Java 2.0](https://docs.jboss.org/cdi/spec/2.0/cdi-spec.html). However, this standard was not fully implemented yet by the Quarkus maintainers.

### The Container

The IoC container of Spring builds on the interfaces `BeanFactory` and `ApplicationContext`. This container takes the POJOs classes and their *configuration metadata* to configure the runtime system. Spring offers various `ApplicationContext` implementations, which allows us to choose different ways of how we want to provide the configuration metadata. The most common ways are XML-based, annotation-based, and Java-based.

The different container implementations have historically emerged in Spring. Quarkus makes a hard cut here and only allows us to use Java-based configuration metadata for our POJOs.

Quarkus' DI container can be accessed via `Arc.container()` or via the JSR 365 interface `CDI.current()`. (The `CDI` implementation just delegates all calls to the `Arc` implementation.)

The `BeanFactory` equivalent in Quarkus can be found once in the `BeanManager`, which can be accessed  via `Arc.container().beanManager()` or `CDI.current().getBeanManager()`. However, we can only query the configuration metadata of all already loaded beans via this manager. The other part of Springs bean factory methods, with which we can programmatically access beans, can be found in the `Arc` or `CDI` instance:

```java
// Spring
MyBean myBean = applicationContext.getBean(MyBean.class);
// Quarkus
MyBean myBean = Arc.container().select(MyBean.class).get();
MyBean myBean = CDI.current().select(MyBean.class).get();
```

In Spring, it is possible to have multiple `ApplicationContext` instances. However, this is not possible in Quarkus. But, we can only override the built-in implementation with our own.

Another essential difference is that Quarkus [removes all unreferenced beans](https://quarkus.io/guides/cdi-reference#remove_unused_beans) (with some exceptions) for optimization reasons. Unlike in Spring, we can no longer access them programmatically at runtime.

### Defining Beans

Next, let's look at the differences in how we define beans. But since Quarkus have a Java-based configuration, we will limit the comparison to Spring's Java-based equivalent.

In Spring and Quarkus, we have two types of annotations to configure a bean: *stereotype* annotations and *scope* annotations.

We use **stereotype annotations** to define recurring architectural patterns. In Spring, the primary stereotypes are `@Component` and its specialization `@Controller`, `@Service`, and `@Repository`. For example, we would use `@Service` to annotate a bean that contains business logic. Unfortunately, Quarkus does not have any built-in stereotype annotations. But it's easy to create our own, but more on that later.

Next, we use **scope annotations** determine the instantiation behavior of a bean. This behavior includes whether the DI container creates a new instance when a bean gets injected into another bean. Or whether an existing instance gets reused. To control the [scope of a bean in Spring](https://www.baeldung.com/spring-bean-scopes), we annotate the class with `@Scope(...)`. [Quarkus has almost an identical set of scopes]({{< ref "overview-of-bean-scopes-in-quarkus.md" >}}), which we'll take a closer look at in a moment.

In the way beans are defined and created, there are two different approaches in Spring and Quarkus:

- The first is that in Spring, we turn a POJO into a bean using a stereotype annotation. Optionally we can add a scope annotation. In Quarkus, on the other hand, it's the other way around. A POJO becomes a bean by adding a scope annotation, and stereotype annotations are optional.

- The second is that in Quarkus, a bean gets lazily created by default, whereas this is done eagerly in Spring.

This difference means we need to rethink when we want to migrate beans from Spring to Quarkus. When defining a bean, we always have to decide when the DI should create it. The role of the bean is secondary. In Spring, we would do this the other way around.

#### Migrating Bean Scopes

Let's take a look at the following simple Spring service:

```java
@Service
public class MyService {
  ...
}
```

Since this bean has no explicit scope annotation, Spring will add the singleton scope by default. The [**singleton scope**]({{< ref "overview-of-bean-scopes-in-quarkus#application-wide-scopes" >}}) will lead the IoC container to create exactly one bean instance and reuse it at every point in the application. Quarkus singeltone equivalents are `@Singleton` and `@ApplicationScoped`. Both have the single instance characteristic. However, they differ on what triggers the creation of the instance. With the first one, the bean gets created when it gets injected into its parent bean. And with the second one, only when a method gets called from the bean.

The other three Spring scopes can be mapped 1:1 in Quarkus: The [**prototype scope**]({{< ref "overview-of-bean-scopes-in-quarkus.md#dependent-scope" >}}), which gets set by the `@Dependent` annotation, leads the IoC container to create a new bean instance for every injection point. Similarly, a [**request scoped**]({{< ref "overview-of-bean-scopes-in-quarkus.md#requestscoped" >}}) bean gets defined with the annotation `@RequestScoped` in Quarkus. And finally, with the help of the Undertow extension, we can set the [**session scope**]({{< ref "overview-of-bean-scopes-in-quarkus.md#sessionscoped" >}}) through the annotation `@SessionScoped`.

#### Migrating Stereotypes

To make it clear again: A stereotype annotation in Quarkus does not define a bean. Instead, we use such annotation to encapsulate recurring characteristics or make the code more readable.

Even if Quarkus doesn't have any built-in stereotypes, we can easily define some ourselves. To do this, we need to create an annotation that is annotated with `@Stereotype`. Optionally, we can give this annotation a scope annotation, which serves as the default scope for the stereotyped bean.

A Quarkus equivalent to Spring's `@Service` annotation would look like this:

```java
@Stereotype
@Singletone // Default scope
@Target(TYPE)
@Retention(RUNTIME)
public @interface Service {
}
```

#### Injecting Beans

Regarding the injection of beans, Quarkus and Spring behave almost identically. In Spring, we use the annotation `@Autowired` on fields, constructors, or setter methods to inject beans into another bean. Quarkus has the same functionality, but it uses the annotations from the [JSR-330 standard](http://javax-inject.github.io/javax-inject/) ([which are also available in Spring](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#beans-standard-annotations)). This standard specifies that we use the annotation `@javax.inject.Inject` to mark an injection point:

```java
@ApplicationScopes
public class MyService {
  
  @Inject
  OtherService otherService;
  
  @Inject // Optional if there are no other constructors
  MyService(OtherService otherService) {
    ...
  }
  
  @Inject
  void setOtherService(OtherService otherService) {
    ...
  }
}
```

##### Injecting a List of Beans

In Spring, we can inject a list of all beans that implement a particular interface:

```java
@Autowired
List<MyInterface> myInterfaces;
```

We can do the same thing in Quarkus, but unfortunately, we must take an extra step. First, we need to get the wrapper instance of the bean:

```java
@Inject
Instance<MyInterface> myInterfaces;
```

From this wrapper object, we can access all bean instances that implement the given interface via `myInterfaces.stream()` or `myInerfaces.forEach(...)`.

#### Eager Initialization and Life Cycle of Beans

As we already learned, in Quarkus, everything related to DI is lazy by default. But, if we want to initialize our bean **eagerly**, we need to use a method that observes the occurrence of the StartUpEvent:

```java
@ApplicationScopes
public class MyBean {
  
  void setUp(@Observe StartUpEvent ignore) {
    // Do eager initialization
  }
}
```

Reacting to the **life cycle** of a bean is the same in Quarkus as in Spring: A method annotated with `@PostConstruct` or `@PreDestroy` gets called after the creation or deconstruction of a bean.

#### Dynamically Creation of Beans

Sometimes it is helpful to create and configure beans depending on runtime conditions. In Spring, we would need a class annotated with `@Configuration` to create the desired beans in methods annotated with `@Bean`. Quarkus equivalent to this is almost identical. The class needs to contain at least one method that has the annotation `@Produces`:

```java
// Spring
@Configuration
public class MyServiceProducer {
  
  @Bean
  public MyService myService() {
    return new MyService();
  }
}

// Quarkus
public class MyServiceProducer {
  
  @Produces
  public MyService createMyService() {
    return new MyService();
  }
}
```

#### Creating Beans Depending on the Profile

Creating a bean depending on the current profile is identical in Spring and Quarkus. We just have to get used to new annotations.

The Spring equivalent of `@Profile("profileName")` would be `@IfBuildProfile("profile")` in Quarkus. If we want to express the opposite (a profile is not active), we would use `@UnlessBuildProfile("profileName")` in Quarkus instead of `@Profile("!dev")` in Spring.

If we have multiple beans that are to be created depending on the profile, we may want to have a "fallback" bean to be used when none of the conditions apply. We do this by annotating the bean or the `@Produces` method with `@DefaultBean`.

We must note here that we always refer to the _build time profile_, since Quarkus does a lot of the CDI handling at build time, as discussed in the chapter [Profiles]({{< ref "migrating-from-spring-to-quarkus.md#profiles" >}}).

#### Naming and Selecting Beans

In Spring, we use `@Component("beanName")`, `@Bean("beanName")`, or `@Qualifier("beanName")` to give a bean a name. The equivalent in Quarkus would be `@Named("beanName")`.

However, there is a fundamentally different behavior regarding the implicit name. Spring's container derives the name of an unnamed bean from the class or method name. In Quarkus, instead, an unnamed bean does not have an implicit name.

Like `@Qualifier("beanName")` in Spring, we use `@Named("beanName")` in Quarkus to select a bean by its name at an injection point. This reference by name is especially needed when we have an ambiguous type. For example, multiple bean classes implement the same interface, which we want to use as the injection point type.

#### Bean Discovery

If we use annotation-based beans in Spring, we need to tell Spring to a component scanning of the classpath. We do this by annotating our main class with `@ComponentScan` (or `@SpringBootApplication` which implicitly adds the annotation for us).

As mentioned several times, the central part of the DI in Quarkus takes place at build time, which is also the case for bean discovery. However, since Quarkus only provides annotation-based beans, we don't need to instruct Quarkus to search for them explicitly. The crucial point here is that the beans must be in the runtime classpath _and_ the compile classpath.

To discover beans in third-party dependencies, Quarkus offers a [variety of options](https://quarkus.io/guides/cdi-reference#bean_discovery). The most powerful tool here is probably the [Jandex index](https://github.com/wildfly/jandex), which allows packing all configuration meta information of a library into a central index at the build time of the library. Alternatively, especially if we cannot customize the third-party file, we can specify in the `application.properties` which dependencies should be searched for beans:

```properties
quarkus.index-dependency.$name.group-id=org.example
quarkus.index-dependency.$name.artifact-id=shared-utils
```

#### Unsupported Spring Bean Features

Not supported yet are the `@Primary` and `@Order` annotations.

##### @Conditional

Spring includes a set of conditional annotations that we can use to control the creation of a bean. For example, we can use `@ConditionalOnJava(value = JavaVersion.ELEVEN)` to make a bean class available to the DI container only if the Java version is greater than or equal to 11.

Such a feature is [not yet available in Quarkus](https://github.com/quarkusio/quarkus/issues/4114) because Quarkus will do most of the DI configuration at build time. An alternative is to [create beans dynamically]({{< ref "migrating-from-spring-to-quarkus.md#dynamically-creation-of-beans" >}}) using the `@Produces` annotations.

However, there is one exception, we can replace `@ConditionalOnMissingBean` with `@DefaultBean` in Quarkus.

##### @DependsOn

With the `@DependsOn` annotation in Spring, we can ensure that a bean gets initialized before another bean, even if that bean gets not explicitly referenced. Unfortunately, [there is no direct replacement](https://github.com/quarkusio/quarkus/issues/5955) for this annotation in Quarkus.

## Migrating Spring Components

This chapter will exemplarily migrate a Spring Web and Spring JPA implementation to their Quarkus equivalents. However, we remain at a very high, abstract level, as each one could fill entire articles.

### From Spring Web to JAX-RS

For REST interfaces, Quarkus uses the [JAX-RS standard](https://jcp.org/en/jsr/detail?id=339) through the [RESTEsay implementation](https://docs.jboss.org/resteasy/docs/3.0.6.Final/userguide/html_single/index.html).

If we want to migrate a Spring REST resource into a JAX-RS resource, we just have to get used to new annotations again. Let's take a look at the following Spring Web resource:

```java
@RestController
@RequestMapping("/hello")
public class HelloController {

  @GetMapping(value = "/{name}",
              consumes = MediaType.TEXT_PLAIN_VALUE,
              produces = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<?> hellp(@PathVariable String name) {
    return new ResponseEntity<>("Hello " + name, HttpStatus.OK);
  }
}
```

An equivalent implementation using JAX-RS in Quarkus would be:

```java
@Path("/hello")
public class HelloResource {

  @GET
  @Path("/{name}")
  @Consumes(MediaType.TEXT_PLAIN)
  @Produces(MediaType.APPLICATION_JSON)
  public Response hello(@PathParam("name") String name) {
    return Response.ok("Hello " + name).build();
  }
}
```

We can find more explanations regarding JAX-RS in this great tutorial from [mkyong](https://mkyong.com/author/mkyong/).

### From Spring JPA Respository to Panache

In Quarkus, we also use JPA for our data modeling and persistence. Therefore, we can continue to use the [JPA annotations](https://thorben-janssen.com/key-jpa-hibernate-annotations/) (`@Entity`, `@ID`, etc.) to define entities and relations. And like in Spring, Hibernate gets used as the favored implementation of JPA in Quarkus, which gets accessed through the library [Panache](https://quarkus.io/guides/hibernate-orm-panache).

In Spring JPA, we would implement the data layer as follows. First, we start with modeling our domain object, for example:

```java
@Entity
public class Employee {
  
  @Id
  @GeneratedValue
  private Long id;
  
  private String name;
}
```

After that, we would use the repository pattern, where we create an interface that extends the interface `Repository` (or a sub-type of it) for each domain object. So, for example, for our `Employee` entry, this would be:

```java
@Repository
public interface EmployeeRepository implements CrudRepository {
  
  Employee findByName(String name);
}
```

Our repository interface inherits many commonly used data managing functions like finding, deleting, and saving. In addition, we can define our own abstract data managing methods whose names are a combination of a function and entity properties (e.g., `findByName`).

#### Panache Repository Pattern

If we want to continue using the [repository pattern in Panache](https://quarkus.io/guides/hibernate-orm-panache#solution-2-using-the-repository-pattern), we only need to make minor changes.

First of all, we can continue to use our domain object as we defined it in Spring JPA without any changes.

The repository remains identical in terms of semantics. We just need to refactor it a bit. First, the interface becomes a class. Then, the `@Repository` annotation becomes a [scope annotation](TODO) so that Quarkus also sees the repository as a bean. The class must then implement the panache interface `PanacheRepository<DomainObject>`, via which our repository then receives the CRUD and other elementary methods. The `EmployeeRepository` would look like this in Panache:

```java
@ApplicationScoped
public class EmployeeRepository implements PanacheRepository<Employee> {
  
  public Person findByName(String name){
    return find("name", name).firstResult();
  }
}
```

Custom data managing methods are more complicated because we have to implement them ourselves, but the underlying logic is relatively straightforward to implement.

#### Panache Active Record Pattern

To simplify things, Panache offers the active record pattern. This pattern merges the domain object and the repository.

For this pattern, our entity class must inherit from `PanacheEntity`. From this class, we inherit the CRUD and other elementary data managing methods, like the ones from the `PanacheRepository`, and the `@ID` field. Our `Employee` class would look like this using Panache's active record pattern:

```java
@Entity
public class Employee extends PanacheEntity {
  
  private String name;
  
  public static Person findByName(String name){
    return find("name", name).firstResult();
  }
}
```
