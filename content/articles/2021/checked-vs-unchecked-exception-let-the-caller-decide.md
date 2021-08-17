---
title: "Checked vs. Unchecked Exception: Let the Caller Decide"
date: 2021-08-12T17:10:31+02:00
draft: false
tags: ["Java", "API Design"]
metaDescription: "Designing an API in way that lets the caller decide to handle exception as checked or unchecked."
---

In Java, sometimes we get into the situation where a method call forces us to handle a checked exception, but we're not interested in it right now. E.g., an `UncaughtExceptionHandler` in the thread may take care of it.

On the other hand, sometimes APIs handle all errors as `RuntimeExcepition`. But for us, the exception handling from this API must be done immediately, for example, by an error dialog so that the exception is not just rushing through.

A nice example of the first case is a method reference call within chained stream calls, as in the following example:

```java
Optional.ofNullable(System.getProperty("config-file"))
  .map(Path::of)
  .filter(Files::exists)
  .map(Files::readAllBytes) // ERROR: 'Unhandled exception: java.io.IOException'
  .ifPresent(fileContent -> {
       ...
  });
```

The chaining of the single operations leads to a clean code if there would not be the IOException, which we have to handle for the `readAllBytes` call. However, we may not be interested in this exception and would like to leave the exception handling to the caller of our method.

To solve the problem, we have to wrap the exception in a RuntimeException. But this has the consequence that the one-liner becomes a six-liner. And that for something that we didn't want to care about.

As seen in the following example, this leads to unnecessary illegibility of the code:

```java
Optional.ofNullable(System.getProperty("config-file"))
  .map(Path::of)
  .filter(Files::exists)
  .map(file -> {
    try {
      return Files.readAllBytes(file);
    }
    catch(IOException e) {
      throw new UncheckedIOException(e);
    }
  })
  .ifPresent(fileContent -> {
       ...
  });
```

## Generics to the Rescue

As designers of an API, we face the dilemma of weighing which error to treat as a checked or unchecked exception.

Fortunately, Java provides us with a mechanism that allows the caller to decide how our API should behave. We may use a generic when specifying the exceptions thrown by a method:

```java
public class MyClass<E extends Throwable> {
  public void doSomething() throws E {
    ...
  }
}
```

If the caller wants to handle errors as a checked exception, he needs to create an instance that uses a checked exception as a type parameter:

```java
new MyClass<IOException>().doSomething(); // Compiler requires handling of the IOException
```

On the other hand, if he doesn't want to do that, he can pass a runtime exception as a parameter type:

```java
new MyClass<UncheckedIoException>().doSomething();
```

However, within the API method, we need to throw the correct exception. Unfortunately, because of the type erasure, we can't do just by instantiating the type parameter:

```java
public void doSomething() throws E {
  throw new E("Error"); // ERROR: We can't create an instance of 'E'
}
```

We need to create a helper construct for this.

### Using a Dedicated Error Handler

The following helper construct is a dedicated error handler, which will handle the creation of the exception:

```java
public abstract class ErrorHandler<E extends Throwable> {
  abstract E createException(String message, Throwable cause);
}
```

From this abstract class (which also could be an interface), we derive two child classes. The first one is creating a checked exception:

```java
public class CheckedExceptionHandler extends ErrorHandler<Exception> {
  @Override
  public Exception createException(String message, Throwable cause) {
    return new Exception(message, cause);
  }
}
```

and the second one is creating a runtime exception:

```java
public class CheckedRuntimeExceptionHandler extends ErrorHandler<RuntimeException> {
  @Override
  public RuntimeException createException(String message, Throwable cause) {
    return new RuntimeException(message, cause);
  }
}
```

Our API method is now getting the error handler instance as an argument and in the case of an error, obtains a new exception instance from it:

```java
public void <E> doSomething(ErrorHandler<E> errorHandler) throws E {
  throw new errorHandler.createException("Error");
}
```

The caller can now decide how he wants our method to behave regarding exceptions in case of an error, by either passing an instance of `CheckedExceptionHandler` or `CheckedRuntimeExceptionHandler`.

## Example for an IOException Error Handler

Since both error handler derivations do not have any instance state, we can make a small optimization here by providing two generic instances. For the handling of `IOExceptions`, this could look like the following example:

```java
public abstract class IoErrorHandler<E extends Throwable> {
  public static final IoErrorHandler<IOException> IO_EXCEPTION = new IoException();
  public static final IoErrorHandler<UncheckedIOException> UNCHECKED_IO_EXCEPTION = new UncheckedIoException();

  public abstract E createException(IOException e);

  private static final class IoExceptionHandler extends IoErrorHandler<IOException> {
    @Override
    public IOException handle(IOException e) {
      return e;
    }
  }

  private static final class UncheckedIoExceptionHandler extends IoErrorHandler<UncheckedIOException> {
    @Override
    public UncheckedIOException createException(IOException e) {
      return new UncheckedIOException(e);
    }
  }
}
```
