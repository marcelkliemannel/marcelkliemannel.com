---
title: Bundling Quarkus With Web Frameworks Like Angular, React, Vue.js in Maven
date: 2021-11-18T22:00:00+02:00
draft: false
tags: ["Quarkus"]
summary: "We are looking at a project architecture that combines the maven and npm toolchains to bundle a web framework frontend and a Quarkus backend into one distributable JAR."
---

Modern web applications build on simple but powerful backend frameworks like [Quarkus](https://quarkus.io) and frontend web frameworks like [Angular](https://angular.io), [React](https://reactjs.org), or [Vue.js](https://vuejs.org).

Quarkus has a built-in mechanism to provide resource files (like JavaScript, HTML CSS) bundled into the Quarkus application JAR via its HTTP framework. This mechanism allows us to deliver the production built of our web framework frontend alongside our APIs.

However, both worlds use different build systems with a sometimes complex toolchain. For example, we have on one side Maven or Gradle for the Quarkus backend and on the frontend side Node.js with package managers like npm. Since we want to automate as much as possible during the build process of our web application, we need to get both systems to work together.

To do this, we will discuss in this article a multi-module approach that allows us to run npm scripts via Maven. These scripts will generate the production build of the frontend, which we then bundle together with the Quarkus backend into one distributable JAR.

The advantage of the multi-module approach is that we can develop both sides independently based on their toolchains. Moreover, during development, this saves us the hassle of always having to rebuild everything all the time. For example, if we work only on the frontend and rebuild it with each change, it is enough to build the backend once and run Quarkus continuously without restarting it every time.

## Basic Project Structure

For the multi-module approach, we need to create a Maven project with three sub-modules. The basic structure of our project would look like this:

```shell
project/
├── pom.xml
├── frontend/
│   ├── app/
│   │   ├── src/
│   │   ├── public/
│   │   │   ├── ...
│   │   │   └── index.html
│   │   ├── ...
│   │   └── package.json
│   └── pom.xml
├── backend/
│   ├── src/main/java/org.example/project/
│   │   └── ApiResource.java
│   └── pom.xml
└── distribution/
    └── pom.xml
```

The three sub-modules have the following responsibilities:

- **frontend**: The `app/` directory of this module contains the frontend sources under `src/`, the npm build system to process these sources and the generated production build result in `public/` (the name of this directory depends on the web framework). (It would also be possible to omit the _app_ directory and put everything directly into the `frontend/` directory. However, this way we have a clear separation between the Maven and npm build system).
- **backend**: This module is like a classic Quarkus project. Here we find the Java sources for the backend and define all the needed Quarkus extensions.
- **distribution**: Through this module, the frontend and backend get merged. The result is one JAR that contains both the backend classes and the distributable frontend files (and optionally all Quarkus dependencies as a so-called "uber JAR").

In the following chapters, we will take a closer look at the individual parts and sub-modules.

## Root pom.xml

Let's start with the root `pom.xml`, which will later serve as the parent for all submodules. We should try to keep this minimal and define what is needed later in all modules. The complete file could look like the following:

```xml
<?xml version="1.0"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd"
         xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <modelVersion>4.0.0</modelVersion>

  <groupId>org.example</groupId>
  <artifactId>project</artifactId>
  <version>1.0.0-SNAPSHOT</version>
  <packaging>pom</packaging>

  <properties>
    <quarkus.platform.version>2.3.1.Final</quarkus.platform.version>
  </properties>

  <build>
    <plugins>
      <plugin>
        <groupId>io.quarkus.platform</groupId>
        <artifactId>quarkus-maven-plugin</artifactId>
        <version>${quarkus.platform.version}</version>
      </plugin>
    </plugins>
  </build>
  
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>io.quarkus.platform</groupId>
        <artifactId>quarkus-bom</artifactId>
        <version>${quarkus.platform.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <modules>
    <module>frontend</module>
    <module>backend</module>
    <module>distribution</module>
  </modules>
  
</project>
```

First, we define the Maven coordinates for the group ID and version, which will later be the same in all sub-modules (lines 8 and 10).

After that, we define the Quarkus version as the global property `quarkus.platform.version` to have a central place to upgrade the version and base all submodules on the same Quarkus version (line 14).

Globally we then apply the Quarkus Maven plugin, as it will get used by the backend and distribution module (line 19-23). Doing this in the root `pom.xml` has the advantage of simply calling `./mvnw :quarkus:dev` directly on the root project, even if it is not a Quarkus application itself. (See the last chapter on how to use the development mode with this multi-module approach).

After that we include the _Bill of Materials_ (BOM) file of Quarkus (lines 27-37). This is used to centrally control and update the versions of the Quarkus extensions and their dependencies.

Finally, we define our project structure by declaring the three directories of the sub-modules (lines 17-31).

## Frontend Sub-Module

In the frontend sub-module, we distinguish between the Maven module and the existing Node.js-based web framework.

The web framework lives in the isolated subdirectory `app/` where we can work with Node.js as if it were a standalone application. As an example of this, let's create a [simple React application](https://reactjs.org/docs/create-a-new-react-app.html#create-react-app):

```shell
npx create-react-app app
```

Inside this directory, we could now start the built-in development server of React with the command `npm start`. This separate directory allows us to work on the frontend with the npm toolchain without running the Maven build process of Quarkus.

In Node.js' `package.json`, we should have defined a script that will generate the production build of the frontend (usually `npm run build`). The result gets generated into a subdirectory (e.g., `public/` in React or `dist/` in Angular), which we then will copy into the JAR of the frontend Maven module.

In the next step, we need to connect the Node.js toolchain to Maven.

Let's start with the following basic structure of a `pom.xml` for our frontend sub-module:

```xml
<?xml version="1.0"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd"
         xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.example</groupId>
    <artifactId>project</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </parent>
  
  <artifactId>org.example-frontend</artifactId>

  <properties>
    <working.dir>app</working.dir>
    <node.version>v16.13.0</node.version>
    <production.build.dir>${working.dir}/dist</production.build.dir>
  </properties>

  <build>
    <plugins>
       ... see following description ...
    </plugins>
  </build>
</project>
```

First, we put the web framework directory in the property `working.dir` (line 17). The following two properties are dependent on the used web framework: the first is the node version (line 18), and the second is the production build directory (line 19).

Now we need two plugins. The first one is the [frontend-maven-plugin](https://github.com/eirslett/frontend-maven-plugin), with which we can run npm commands from Maven. Another advantage of this plugin is that it can install Node.js and npm locally in the required version. This feature allows us to build our project without the need to install external software on the machine. Furthermore, the plugin is even more powerful: it supports calling other tools from Maven like Bower, Grunt, Webpack, or yarn out of the box.

The minimum required configuration of this plugin would be as follows:

```xml
<plugin>
  <groupId>com.github.eirslett</groupId>
  <artifactId>frontend-maven-plugin</artifactId>
  <version>1.12.0</version>
  <configuration>
    <workingDirectory>${working.dir}</workingDirectory>
    <nodeVersion>${node.version}</nodeVersion>
  </configuration>    
  <executions>
    <execution>
      <id>Install Node.js and npm</id>
      <goals>
        <goal>install-node-and-npm</goal>
      </goals>
      <phase>generate-resources</phase>
    </execution>  
    <execution>
      <id>npm run build</id>
      <goals>
        <goal>npm</goal>
      </goals>
      <configuration>
        <arguments>run build</arguments>
      </configuration>
      <phase>generate-resources</phase>
    </execution>   
  </executions>
</plugin>
```

First we need to configure the working directory, which is our web framework directory `app/` (line 6) and the Node.js version (line 7).

Then, for the Maven life cycle phase *generate-resources*, we define two executions: The first is the plugin's built-in `install-node-and-npm` which takes care of the local installation of Node.js as described above. And the second one is to run the npm script `npm run build` to generate the production build.

After generating the frontend production build resources, we need to bring them to the Maven world. Quarkus already has a mechanism built in to deliver resources via HTTP. For this, we must put the files into the `META-INF/resources/` directory. To copy them there during the *compile* life cycle phase of Maven, we use the [Maven resources plugin](http://maven.apache.org/plugins/maven-resources-plugin/), which gets configured as follows:

```xml
<plugin>
  <artifactId>maven-resources-plugin</artifactId>
  <version>3.2.0</version>
  <executions>
    <execution>
      <id>copy-resources</id>
      <phase>compile</phase>
      <goals>
        <goal>copy-resources</goal>
      </goals>
      <configuration>
        <outputDirectory>${basedir}/target/classes/META-INF/resources/</outputDirectory>
        <resources>
          <resource>
            <directory>${production.build.dir}</directory>
            <filtering>false</filtering>
          </resource>
        </resources>
      </configuration>
    </execution>
  </executions>
</plugin>
```

### Clean Up

When we call the Maven life cycle phase _clean_, all `target/` directories are getting deleted, and thus also the copied production build files. However, this does not affect the generated files inside the `app/` directory. 

There are two ways to include their deletion into the _clean_ phase. One way would be to define a npm script `npm run clean` (see the article [1000 ways to npm clean](https://medium.com/@codejamninja/1000-ways-to-npm-clean-1a514525a13c)), which we include as execution to the _frontend-maven-plugin_ plugin for the _clean_ phase:

```xml
<execution>
  <id>npm run clean</id>
  <goals>
    <goal>npm</goal>
  </goals>
  <configuration>
    <arguments>run clean</arguments>
  </configuration>
  <phase>clean</phase>
</execution> 
```

The other way would be to add the [Maven Clean Plugin](https://maven.apache.org/plugins/maven-clean-plugin/) and configure it to the delete production build directory:

```xml
<plugin>
  <artifactId>maven-clean-plugin</artifactId>
  <version>3.1.0</version>
  <configuration>
    <filesets>
      <fileset>
        <directory>${production.build.dir}</directory>
      </fileset>
    </filesets>
  </configuration>
</plugin>
```

## Backend Module

The `pom.xml` file for the backend sub-module looks almost like a regular single-module Quarkus project:

```xml
<?xml version="1.0"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd"
         xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.example</groupId>
    <artifactId>project</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </parent>
  
  <artifactId>org.example-backend</artifactId>

  <dependencies>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-resteasy</artifactId>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.8.1</version>
        <configuration>
          <source>11</source>
          <target>11</target>
          <parameters>true</parameters>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
```

We first define our Quarkus extensions dependencies (lines 16-21). And then include and configure the Maven compiler plugin to treat the module as a Java module (lines 25 -33).

## Distribution Module

The distribution module bundles the frontend and backend and serves as the main entry point for our application. Its `pom.xml` file looks like this:

```xml
<?xml version="1.0"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd"
         xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.example</groupId>
    <artifactId>project</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </parent>

  <artifactId>project-distribution</artifactId>

  <properties>
    <quarkus.package.type>uber-jar</quarkus.package.type>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.example</groupId>
      <artifactId>project-backend</artifactId>
      <version>${project.version}</version>
    </dependency>

    <dependency>
      <groupId>org.example</groupId>
      <artifactId>project-frontend</artifactId>
      <version>${project.version}</version>
    </dependency>
  </dependencies>
  
  <build>
    <plugins>
      <plugin>
        <groupId>io.quarkus.platform</groupId>
        <artifactId>quarkus-maven-plugin</artifactId>
        <version>${quarkus.platform.version}</version>
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
    </plugins>
  </build>
</project>
```

First, we define the packaging format in property `quarkus.package.type` (line 17). In our example application, we use `uber-jar`, which includes frontend and backend and all other project dependencies. For more options and detailed explanations see the [official documentation](https://quarkus.io/guides/maven-tooling#build-tool-maven),

Next, the two dependencies to the frontend and backend modules (lines 21-32).

And finally, we configure the Quarkus Maven plugin to be active for this module in the three specified execution goals (lines 36-50). With this, the Quarkus machinery gets called during the Maven life cycle.

## Running Quarkus in Development Mode

If we have a clean Maven project and start Quarkus in development mode via the command `./mvnw :quarkus:dev`, the Maven build will fail with the following error:

```shell
[ERROR] Failed to execute goal io.quarkus.platform:quarkus-maven-plugin:2.3.1.Final:dev (default-cli) 
   on project project-distribution: Failed to run: 
   Hot reloadable dependency org.example:project-frontend::jar:1.0.0-SNAPSHOT 
   has not been compiled yet 
   (the classes directory /Users/john/project/frontend/target/classes does not exist) -> [Help 1]
```

The problem here is that Maven does not automatically build the dependencies of the distribution module to the other sibling modules. Therefore, the frontend must be built _with Maven_ at least once before starting the backend. To build the frontend, we have to call `./mvnw compile` at least once.

If the problem persists, we probably did not correctly reference the production build directory of Node.js in the `pom.xml` of the frontend module. Or the npm build task didn't produce any output. An indication of this is the following hint in the log:

```shell
skip non existing resourceDirectory ...frontend/app/non-existing-public
```

If no resources have been copied from the Node.js output to the Maven target directory, Maven will not build a JAR because there is no `target/classes/` directory.
