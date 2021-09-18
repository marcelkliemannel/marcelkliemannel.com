---
title: "Custom MicroProfile Configuration Sources in Quarkus"
date: 2021-09-18T13:01:42+02:00
draft: false
tags: ["Quarkus"]
summary: "In this article we will look at the mechanisms provided by the MicroProfile Config API to define custom configurations source in Quarkus."
---

Based on the [MicroProfile Config API](https://microprofile.io/project/eclipse/microprofile-config), Quarkus offers a potent tool to configure an application.

Configuration values can be obtained out-of-the-box from a cascade of [configuration sources](https://quarkus.io/guides/config-reference#configuration-sources). And one of the best-known sources is probably the `application.properties` file. And values from these sources can be injected into a field of a bean using the annotation `@ConfigProperty`:

```java
@ApplicationScoped
public class MyService {
  
  @ConfigProperty(name = "my-service.important-value")
  String importantValue;
}
```

There may be the need to get configuration properties from other sources than the built-in ones of Quarkus. Such sources could be, for example:

- Configuration files from other applications on the system.
- Properties that we can only be calculated dynamically at runtime.
- Standardized configuration files for used libraries.

To achieve this, the MicroProfile Config API provides us with several extension points with which we can provide properties values via a custom configuration source.

## Implementing a Custom Configuration Source

Our custom configuration source must implement the interface `org.eclipse.microprofile.config.spi.ConfigSource`.

MicroProfile will load the implementation of this interface at runtime using Java's service loader mechanism. For this, we need to write the full name of our class (package name + class name) in a text file with the name `org.eclipse.microprofile.config.spi.ConfigSource`, which gets placed into the directory `META-INF/services/`.

The interface requires us to implement at least three methods, which we will look at in more detail in the following chapters.

### Providing all Available Property Names

Let's start with the method `Set<String> getPropertyNames()`. This method *can* return the names of the properties that our configuration source provides. Depending on the usage of our configuration source, it may be sufficient to return only a subset or even an empty set. 

For pure injecting of properties, as we saw at the beginning of the article, this set is unnecessary (we will see why in the next chapter). 

This method gets primarily used when someone whats to get all the properties of our config source at once. The interface offers for that purpose the method `ConfigSource#getProperties()` which returns a `Map<String, String>`. The default implementation of this method iterates over all returned `getPropertyNames()` to retrieve the individual values.

We should note that `getPropertyNames()` (and also `getProperties()`) can be called several times. If we always return a fixed set, we should calculate it only once and return the reference to the set.

### Providing Property Values

The next method we need to take care of is `String getValue(String propertyName)`, which provides the value of a property with the given name. The critical point here is that this method gets called for all properties in the entire application for which MicroProfile could not determine a value yet. Therefore, if we cannot resolve a value ourselves or are not responsible for a property, we must return `null`.

We can see a limitation of the MicroProfile Config API based on the declaration of the method: We can only work with simple string property values. MicroProfile's properties injection is powerful enough to map certain simple data types, but we cannot use more complex objects here. (E.g., the property string "true" can be injected into a `boolean` field.)

From the architecture of the second method, we can also see another interesting ability: Overriding property values that come from other configuration sources. The evaluation order of configuration sources gets determined by the return value of the method `ConfigSource#getOrdinal()`. If we return an integer value higher than that of another configuration source, we are first asked for a value and can override it. The [JavaDoc](org.eclipse.microprofile.config.spi.ConfigSource) of the `getOrdinal()` method has a good discussion about what ordinal number is appropriate in what situation.

### Give the Configuration Source a Name

The last method we need to implement is `String getName()`. It should return a descriptive name of our configuration. This name may be used later by MicroProfile for logging, for example. This name also gets used to determine the ranking order if two sources have the `ConfigSource#getOrdinal()` value.

### Example Implementation

In the following example, we read a custom properties file and make its names and values available via the MicroProfile Config API:

```java
public class CustomConfigSource implements ConfigSource {
  
  private static final Path propertiesFile = Path.of(...);
  
  private final Map<String, String> properties;

  CustomConfigSource() {
    try (Reader reader = Files.newBufferedReader(propertiesFile)) {
      var properties = new Properties();
      properties.load(reader);
      var collector = Collectors.toMap(entry -> String.valueOf(entry.getKey()), 
                                       entry -> String.valueOf(entry.getValue());
      this.properties = properties.entrySet().stream().collect(collector);
    }
    catch (IOException e) {
      throw new IllegalStateException("Failed to read properties file: " + propertiesFile, e);
    }
  }

  @Override
  public Set<String> getPropertyNames() {
    return properties.keySet();
  }

  @Override
  public String getValue(String propertyName) {
    return properties.get(propertyName);
  }

  @Override
  public String getName() {
    return "custom-config";
  }
}
```

## Providing Different Configuration Sources With a Factory

Sometimes we get into the situation where we want to create an instance of our `ConfigSource` implementation depending on certain factors. 

The most classic example is that we want to provide different properties depending on the current profile. Or that we want to make our configuration source dependent on other properties.

We can implement a `io.smallrye.config.ConfigSourceFactory` to accomplish this, which will create and return our custom configuration source. MircoProfile also loads this factory via Java's server loader mechanism. For this, we place a file with the name `io.smallrye.config.ConfigSourceFactory` into the directory `META-INF/services/`, which contains the full name of our factory class (package name + class name). Note here that if we use a factory, the individual `ConfigSource`s do not have to get loaded via the service loader mechanism. 

In the following example factory, we create a custom configuration source based on the current profile:

```java
public class CustomConfigSourceFactory implements ConfigSourceFactory {

  @Override
  public Iterable<ConfigSource> getConfigSources(ConfigSourceContext configSourceContext) {
    if (configSourceContext.getProfiles().contains("dev")) {
      return Set.of(new DevelopmentCustomConfigSource());
    }
    else {
      return Set.of(new CustomConfigSource());
    }
  }
}
```

Via the `ConfigSourceContext` parameter, we can also access all other properties. For example, the current HTTP port: `configSourceContext.getValue("quarkus.http.port").getValue()`.