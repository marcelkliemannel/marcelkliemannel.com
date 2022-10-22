---
title: "JVMs Manager"
gitHub: "https://github.com/marcelkliemannel/intellij-jvms-manager-plugin"
jetBrainsMarketplace: "https://plugins.jetbrains.com/plugin/19464-jvms-manager"
---

This IntelliJ plugin provides a task-manager-like tool window to monitor and manage Java Virtual Machines.

{{< retina-image jvms-table2x.png "Running JVMs List" >}}

#### Key Features

- The main part of the tool window is a tree table that lists all running JVM processes and their child processes.
- For each JVM process the process details contains information about the main class, attached debugger and Java agents, and system properties.
- Besides that, the process details provides the memory usage, command line, environment variables, uptime, and a lot more.
- here is an easy-to-use UI to access detailed information about any running JVM process, like getting a thread dump, version, classloader hierarchy, and the heap space.
- In addition, the plugin provides a one-click solution to trigger the garbage collection and start the OpenJDK JVM monitoring tool.
