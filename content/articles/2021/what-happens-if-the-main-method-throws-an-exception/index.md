---
title: "What Happens if the Main Method Throws an Exception?"
date: 2021-09-07T20:23:03+02:00
draft: false
tags: ["Java"]
summary: "By breaking down the JVM shutdown sequence, we want to understand code execution in threads, thread groups, global exception handling, and what else happens when falling beyond the main method."
---

If we write a simple main method in Java that does nothing but throw an exception:

```java
public class MyClass {
  
  public static void main(String[] args) {
    throw new IllegalStateException();
  }
}
```

we get the following output and the JVM exits:

```
Exception in thread "main" java.lang.IllegalStateException
	at org.acme.Main.main(Main.java:10)
```

But how? The question may sound trivial because the behavior of the main seems so familiar. However, the answer gives us a deeper understanding of how threads work, thread groups, global exception handling in Java, and what happens during the shutdown of the JVM.

## What Happens With a Method if It Throws an Exception

Every Java code in the Java Virtual Machine (JVM) runs in a Java thread, so does our main method, even though we haven't explicitly encapsulated it in a thread. And this thread has the name – surprise – *main*.

Next, each Java thread has a stack of method frames. A method frame is a container that contains all the information which are necessary for the execution of a method. If another method gets called, the execution of the current frame gets paused. And a new frame gets created for the called method, which gets packed on top of the stack. Which, in turn, gets removed if the execution of the called method finished. After that, the execution of the method from the underlying method frame will continue.

An essential component of a frame is the operand stack. It included all byte code instructions, which the Java Compiler transformed from the Java source code. And the byte code of our main method looks like this:

```java
NEW java/lang/IllegalStateException
DUP
INVOKESPECIAL java/lang/IllegalStateException.<init> ()V
ATHROW
```

(In understandable language, it says: 1.) Create a new object of type `IllegalStateException` and put the reference to it on the stack; 2.) duplicate this reference on the stack (this information is now available twice); 3.) consume the last reference on the stack and call its constructor, and 4.) throw the remaining reference to the exception object on the stack as an exception.)

When the JVM hits an `ATHROW` operation, the following happens: It passes over all subsequent operations without executing them until it finds a `catch` block that can handle the exception type or reaches the end of the operand stack. (Any `finally` blocks that may be present will still be executed.) 

When the end of the operand stack gets reached, the JVM passed the exception to the underlying frame. And here, the same exception handling procedure is gone through again, as described in the previous paragraph.

In our main example, we reach an interesting point after throwing the exception: we fall beyond the main method, and the method frame gets removed from the stack, but there is no underlying frame.

## Starting the JVM Shutdown Sequence

Since there is no Java code after the main method, we fall back into the native JVM code to the point where the Java main method was called: [the main method of the Java executable](https://github.com/openjdk/jdk/blob/eec64f55870cf51746755d8fa59098a82109e826/src/java.base/share/native/libjli/java.c#L545). After this point, the JVM now starts the [JVM shutdown sequence](https://github.com/openjdk/jdk/blob/92b05fe0f41b91aa88e77473725ae92ee13b052f/src/hotspot/share/runtime/thread.cpp#L3350).

In this sequence, the JVM first waits for all non-daemon threads to terminate. This behavior is also why we can fall beyond the end of the main method, but the JVM does not terminate in some circumstances. For example, we would see the output `End of main reached` immediately after the JVM started by executing the following code:

```java
public static void main(String[] args) {
  new Thread(() -> { while (true) {} }).start();
  System.out.println("End of main reached");
}
```

This output indicates that the main method returned. But because of the running non-daemon thread, the JVM "hangs" in the shutdown sequence.

If we look at a thread dump in this situation, we would see that the main thread no longer exists, but a new thread named *DestroyJavaVM* has popped up. Technically, this is the same thread as the main thread. It is the same system thread. However, the shutdown sequence has opened a new Java thread for this system thread.

But before we continue in the shutdown sequence, let's take a closer look at the thread termination process.

The first thing that happens during the termination of a thread is to check if there is still an uncaught exception, what waits to get handled. If this is the case, the uncaught exception machinery gets in motion.

## The Uncaught Exception Machinery

Before we go any further, we first need to understand how threads are structured in Java.

We have already learned that each method runs in a thread and that our main method runs in a thread named *main*. 

A thread is always bound to a thread group. And the thread group of the main thread has the name – again very surprisingly – *main*. Such a thread group can be a child of another thread group. And the topmost thread group, which does not have a parent, has the name *system*. For our main method, this results in the following hierarchy:

![Thread Structure](thread-structure.svg#center)

If there is a pending uncaught exception during the termination process of a thread, the private method `Thread#dispatchUncaughtException()` gets called. This method now checks whether the current thread has a `Thread.UncaughtExceptionHandler` handler set via `Thread#setUncaughtExceptionHandler()` (which is not the case by default). Alternatively, it uses the `ThreadGroup` of the current thread as the exception handler because it implements the `UncaughtExceptionHandler` interface.

The method `UncaughtExceptionHandler#uncaughtException()` gets now called on the found exception handler with the exception as an argument. This method does the following in the default implementation:

1. If there is a parent thread group, dispatch the exception handling to the parent by calling its `uncaughtException()`.
2. Otherwise, check if a global static exception handler was set via `Thread#setDefaultUncaughtExceptionHandler()`. If so, dispatch the exception to this handler. 
3. If none of the previous cases apply, print the exception's stack trace to the standard error output.(This case produced the output we have seen right at the beginning of the article for our main example.)

If no exception handler could be found for the main method, the native code of the JVM prints the exception's stack trace to the standard error stream.

## Clean Up After Ourselves and Exit the JVM Process

We have now seen what happened to the exception after we left the main method. So how does the shutdown sequence continue now?

After the termination of all non-daemon threads, the JVM starts executing all the shutdown hooks added via `Runtime.getRuntime().addShutdownHook(Thread)`.

After that, all internal shutdown hooks are executed. Among other, this includes the hook set by marking a `java.io.File` object with `File#deleteOnExit()`.

We have now reached the point where no more Java code will be executed. 

To see what happens next, we have to go back to the start of the JVM. During the start, the JVM starts a system thread called _VMThread_ (this thread has no associated Java thread). This thread is responsible for background operations to keep the JVM running. One of its most important tasks is to start the garbage collection. After this thread is started, it runs in an infinite loop and waits for new operations to execute until a termination flag is set.

The shutdown sequence now sets that termination flag and thus brings the main artery of the JVM to a halt. During this process, any Java daemon threads that may still be running are also getting terminated.

What still runs in the JVM are system threads started by native code. These are not terminated directly by the JVM. Instead, the shutdown sequence sets a global flag that the JVM is in the exit state. The consequence is that native code can no longer access Java code, which leads to a de facto stop of these.

And now we are through. The JVM process terminates and returns to the caller.

If we didn't set the return code explicitly via  `System.exit(int)` , it's is determined quite simply: `1` if an uncaught exception occurred in the main method, `0` otherwise.