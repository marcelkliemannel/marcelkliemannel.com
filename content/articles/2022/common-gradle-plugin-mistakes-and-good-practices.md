---
title: "Common Gradle Plugin Mistakes and Good Practices"
date: 2022-07-23T20:00:00+02:00
draft: false
tags: ["Gradle"]
summary: "This article will examine some dos and don'ts for Gradle plugin developers. These include common implementation issues that complicate the usage of third-party plugins and some principles for an ideal plugin API."
---

While using third-party plugins in Gradle for years in smaller and larger projects, I often stumble over the same flaws. From this experience, we want to discuss typical Gradle plugin issues in this article and derive some good practices.

## Don't Escape the Project Scope

In Gradle, a plugin always gets applied to one particular project.

So, if we add ``plugins { `java` }`` to the root `build.gradle.kts`, only the root project would have the `java` plugin, but not any of its sub-projects. For the sub-projects to get this plugin as well, we would have to apply it explicitly, e.g., by  `subprojects { apply(plugin = "java-library") }`.

A basic rule follows from this behavior: A plugin should add tasks, extensions, configuration, etc., only to the project it was applied to.

Unfortunately, some plugins break this rule and add components to the root project or sub-projects, as seen in the following example:

```kotlin
class MyPlugin : Plugin<Project> {
  
  override fun apply(target: Project) {
    // Don't do this: Add task to root project
    target.rootProject.extensions.create("rootExtension", MyExtension::class.java)

    // Don't do this: Add task to all subprojects
    target.subprojects.forEach { subProject ->
      subProject.tasks.register("taskInSubProject", MyTask::class.java)
    }
  }
}
```

Escaping the target project is a no-go because it may break the semantics of the project structure.

Since Gradle is a powerful tool beyond the Java universe, a project could have, for example, an npm or a C++ sub-project, in which Java-related tooling would make no sense. Also, there is the concept of having a "dump" root project without any build logic and then having distinct sub-projects (e.g., one for frontend, backend, and release).

## Never Walk the Project Tree Upwards

Sometimes, there is the need to create a task that aggregates the results of other tasks.

A typical example of that is a task that merges all test reports of the `test` tasks from all sub-projects into one single file.

Such an aggregation task must find all tasks of a particular type in the project structure. Creating this collection is often done by iterating over the `subprojects` method of the root project:

```kotlin
project.rootProject.subprojects.forEach { subproject -> 
  subproject.tasks.withType(MyTask::class).forEach { myTask -> 
    ...
  }
}
```

However, we may run into the same problem described in the previous chapter: by walking the project tree upwards, which is what we are doing using the `rootProject`, we may escape the project scope.

The thinking mistake is probably assuming that Gradle can only have one level of subprojects. But this is not true. There could be a nested project structure like this:

```txt
|- Root Project
|-- A
|-- B
|--- B-2-1
|---- B 2-1-1
|--- B-2-2
```

So, if only project *B* and its sub-projects have the plugin applied, why should an aggregated task also contain the results of project *A*? There is no relation between *B* and *A*.

## Declare Tasks Outputs

Some plugin tasks are writing their outputs directly into the build directory of the project:

```kotlin
@TaskAction
fun myAction() {
  val outputDir = File(project.buildDir, "my-task")
  File(outputDir, "output.txt").writeText("Task Output")
}
```

This approach brings some disadvantages:

- Other tasks can't simply access the task outputs via the designated Gradle API `Task#outputs`.
- Gradle creates a `clean$TaskName` task for each task which cleans only the outputs of this particular task. But this task can only work if the plugin task declares any outputs.
- Changes in the task outputs are one of the main indicators for Gradle's "up-to-date" logic. Without a declared task output, Gradle will probably always re-run the task.

So instead, the task should declare its output as properties, with one of the four `@Output*` annotations:

```kotlin
@OutputDirectory
val outputDir: DirectoryProperty = project.objects.directoryProperty()
  .convention(project.layout.buildDirectory.dir("my-task"))

@TaskAction
fun myAction() {
  File(outputDir.get().asFile, "output.txt").writeText("Task Output")
}
```

## Strong vs. Soft Task Relationships

Gradle distinguishes between *strong* and *soft* relationships between tasks.

If we define the strong relationship between tasks A and B (e.g., by using `dependsOn` or `finalizedBy`) and execute only task A, Gradle will also execute task B. In contrast, if we define the soft relationship between both (e.g., using `mustRunAfter` or `shouldRunAfter`) and execute only task A, Gradle will not execute task B. But if we execute A and B, Gradle will execute them in the correct order.

As a general rule, tasks from plugins should prefer to use soft relations to other tasks. This rule provides the most flexibility for the plugin user. If he only wants to execute this particular task, he does not need any exclusions. And if he wants a strong relationship, he can create it with a one-liner.

In addition, it's not uncommon for a plugin not to define task relationships. Instead, the plugin authors often point out in their documentaiton that a relationship needs to be specified explicitly.

## Connect Inputs/Outputs of Tasks for Relationships

A typical function of tasks is processing the outputs of other tasks. For example, a task that makes byte code modifications would need the class files from the output directories of the `compile` task.

If task B needs the output of task A, Gradle must execute A before B. When we want to implement this relationships, there is one rule: never define task relationships within the task action.

Doing it the wrong way would look like this:

```kotlin
open class B : DefaultTask() {
  
  @TaskAction
  fun taskAction() {
    // Don't do this
    tasks.findByName("A")!!.outputs.files.forEach { outputFile ->
      ...
    }
}
  
tasks.register("B", B::class.java) {
  dependsOn(tasks.named("A"))
}
```

In the task action of B, we have a hard-coded dependency to task A to retrieve A's output files. And to make sure that A produces some outputs, we are defining that task B depends on A. So Gradle will execute A before B.

While this design serves its purpose, it poses some disadvantages for our plugin user. For example, if the user wants to use a custom task C instead of A, he can't tell B to use C. Also, if he wants to use the outputs of A and C, he can't change B to use the files from both.

Instead, we should define all task dependencies via file properties, with one of the four `@Input*` annotations. So, in the above example, task B would have a `ConfigurableFileCollection` property, marked as `@InputFiles` . We then connect this input property to the output of A:

```kotlin
open class B : DefaultTask() {
  
  @InputFiles
  val inputFiles: ConfigurableFileCollection = project.objects.fileCollection()

  @TaskAction
  fun taskAction() {
    inputFiles.forEach { inputFile ->
       ...
    }
  }
}

tasks.register("B", B::class.java) {
  inputFiles.setFrom(tasks.named("A"))
}
```

(We should note that `setFrom` defines a strong relationship between A and B. As discussed in the previous chapter, it's good to weigh whether the plugin code should contain this relationship explicitly.)

## Limit the Usage of Log Level "lifecycle" or Standard Output

During the execution of Gradle, we will get a constantly updating progress indicator output:

```bash
❯ ./gradlew build
<===----------> 23% EXECUTING [3s]
> :compileKotlin
> IDLE
```

Gradle uses a technique that overwrites the existing console output repeatedly. And at the end, we have a clean two-line console output with the execution result:

```shell
❯ ./gradlew build
BUILD SUCCESSFUL in 4m 33s
12 actionable tasks: 6 executed, 6 up-to-date
```

However, if we log with the level `lifecycle` or write something to the standard output, it stays in the console output after Gradle's execution:

```bash
❯ ./gradlew build
> Task :myTask
Log output from myTask

BUILD SUCCESSFUL in 4m 35s
12 actionable tasks: 6 executed, 6 up-to-date
```

But let's look at the built-in Gradle tasks: Does `compileJava` logs at this level that it started compiling? Or `test` that it has begun with the test execution? They don't do that until we run Gradle with the log level `--info`.

Generally, we should use log levels over `info` only when the output is *always* relevant to the user.

## Lazy Configuration and Configuration Avoidance

A negative impact on Gradle's performance can come from the configuration of tasks during the *project* configuration phase. Ideally, the build logic should configure a task as late as possible and only if the task is part of the execution.

Especially when working on large Gradle projects, a broken lazy configuration can cost lots of additional build and therefore unproductive waiting time. So, plugin authors should avoid any lazy configuration pitfalls.

The Gradle documentation provides two excellent and in-depth pages which deal with this problem: [Lazy Configuration](https://docs.gradle.org/current/userguide/lazy_configuration.html) and [Task Configuration Avoidance](https://docs.gradle.org/current/userguide/task_configuration_avoidance.html).

One of the most common errors is that a plugin uses `create` instead of `register` when creating a task:

```kotlin
// Don't do this: This triggers the task initialization
val myTask: Task = target.project.create("myTask") {
  ...
}

// Correct
val myTask: TaskProvider<Task> = project.tasks.register("myTask") {
  ...
}
```

Also evil is to work with a `Task` object during the configuration phase instead of using the `TaskProvider`:

```kotlin
// Don't do this: This triggers the task initialization
val jarTask: Task = project.tasks.getByName("jar")
dependsOn(jarTask)

// Correct
val jarTask: TaskProvider<Task> = project.tasks.named("jar")
dependsOn(jarTask)
```

Besides such obvious cases, there are sometimes smaller things that can have a big performance impact. For example, we should be aware that the following code will trigger the resolution of all dependencies, which requires expensive network and disk IO:

```kotlin
// It is best to do this only within a task action
target.configurations.getByName("runtimeClasspath").resolvedConfiguration.files.forEach { 
  ...      
}
```

## Don’t Apply Other Plugins

Generally, we should adhere to the following logic: If someone wants our plugin to use the outputs of another plugin, *he* must provide this plugin, not our plugin.

Let's say we created a plugin that signs the `jar` task outputs. This plugin would only work if the project also has the `java` plugin applied because it provides the `jar` task. So, from a semantic point of view, our plugin has one well-defined function. But, if our plugin automatically applies the `java` plugin, it also serves all the functions of the `java` plugin.

The user might now be inclined to use only our plugin since he implicitly gets the `java` plugin. However, this violates clean code principles at different levels, mainly because we should avoid to use functionalities from implicit dependencies. Especially in the case of implicit Gradle plugins, it should be noted that they do not only serve as code libraries, but also affect the project configuration. Therefore, we should not encourage our plugin users to use implicit dependencies.

Our plugin should apply logic only when all required plugins are present in the project:

```kotlin
fun apply(target: Project) {
  if (target.plugins.hasPlugin("java")) {
    ...
  }
  // Or
  target.pluginManager.withPlugin("java") {
    ...
  }
}
```

## Use the Default Dependencies Set for Plugin Configurations

Sometimes we have to create an "internal" configuration for our plugin's logic to use Gradle's dependency resolution mechanism.

A good practice for this configuration is not to add the dependencies directly but to add them to the `defaultDependencies` set:

```kotlin
target.configurations.create("myConfiguration") { it ->
  // Don't do this
  it.dependencies.add(project.dependencies.create("com.company:artefact:1.0.0"))

  // Do this instead
  it.defaultDependencies {
    it.add(project.dependencies.create("com.company:artefact:1.0.0"))
  }
}
```

The difference is that the default dependencies are only added to the configuration if the plugin user didn't set them by themself. Otherwise, he would have to add additional code to remove or substitute the default dependencies.

## Validate the Minimum Gradle Version

If our plugin requires a minimum Gradle version to run, then our plugin should check this condition during the application of the plugin, as shown in the following code:

```kotlin
class MyPlugin : Plugin<Project> {
  
  override fun apply(project: Project) {
    if (GradleVersion.version(project.gradle.gradleVersion) < GradleVersion.version("7.1")) {
      project.logger.error("The plugin 'My Plugin' requires at least Gradle 7.1.")
      return
    }
    ...
  }
}
```

(Alternatively, we could also throw a `GradleException` instead of an error log entry.)

Otherwise, our plugin user may face some nasty, vacuous `NoClassDefFoundError`s or similar exceptions during runtime if he is on an incompatible version.

## Providing the Names of Tasks, Extensions, or Configurations as a Constant

Last but not least: it's a good practice to provide the default names of tasks, extensions, or configurations as constants (public, static, final fields in Java terms):

```kotlin
class PluginTask : DefaultTask {
  
  companion object {
    const val TASK_NAME : String = "pluginTask";
  }
  ...
}

class PluginExtension {
  
  companion object {
    const val EXTENSION_NAME : String = "pluginExtension";
  }
  ...
}
```

Without these constants, the plugin user must reference our plugin components with a hard-coded String in his code, for example, `project.tasks.getByName("pluginTask")`.

In a newer version of our plugin, we may rename the task name or delete it. But with a hard-coded String, the build logic may not notice this API-breaking change until very late at runtime. If the plugin user can use a code reference instead, like `project.tasks.getByName(PluginTask.TASK_NAME)`, changing the task name has no effect, or the code would fail directly at compile time.
