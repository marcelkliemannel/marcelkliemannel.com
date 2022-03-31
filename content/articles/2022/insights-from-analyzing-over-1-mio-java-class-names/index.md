---
title: "Insights From Analyzing Over 1 Million Java Class Names"
date: 2022-02-06T19:55:05+02:00
draft: false
tags: ["Java", "Best Practice"]
summary: "An analysis of class names from the most popular Java repositories on GitHub. In particular, we will try to give a statistical answer for naming controversies, such as the case sensitivity of abbreviations."
---

Is it `SqlManager` or `SQLManager`? Which stereotypical postfix best describes the purpose of my class? Choosing a good class name sometimes feels more challenging than programming.

This article will look at how the most popular Java repositories on GitHub apply class naming conventions in practice. Based on the result from analyzing over 1.3 million class names from over 2,300 repositories, we could draw new inspirations (e.g., postfixes) and bolster arguments for naming controversies with statistical figures.

## The Sample Data

We use the most popular GitHub repositories for the following analysis (based on the number of awarded stars) because they form the backbone of the Java ecosystem (e.g., Spring, Apache Commons, Log4J, Jackson). Many, if not almost all, Java projects depend on these repositories and are inspired by their coding principles. Therefore, the selected sample should have good representativeness.

The GitHub search API makes it easy to get a JSON Array of all repositories which are using Java in descending order of their popularity:

```json
GET https://api.github.com/search/repositories?sort=stars&order=desc&q=language:java&page=1&per_page=100

{"total_count": 10816023, "incomplete_results": true, "items":
 [ { "id": 20300177,
      "full_name": "google/guava",
      "trees_url": "https://api.github.com/repos/google/guava/git/trees{/sha}",
      "default_branch": "master",
      ... },
    ...
  ] }
```

With the `trees_url`, we can get all the files in a repository for its `default_branch`:

```json
GET https://api.github.com/repos/google/guava/git/trees/master?recursive=1

{ "tree": [
  { "path": "guava/src/com/google/common/util/concurrent/SmoothRateLimiter.java" },
  { "path": "guava/src/com/google/common/util/concurrent/Striped.java" },
  ...
] }
```

Using this method, we can obtain 2,830,728 filenames from 2,353 repositories. (side fact: These repositories contain ~63 GB of data).

From the set of all filenames, we want those that belong to Java sources. Therefore, we filter the names for the ones with the extension .`java`. The result is a reduced set of 1,387,857 files.

Since we are only working at the filename level and cannot look at the contents of a file, we need other indicators of whether it is a Java source file. A good indicator is to validate that the filename is a valid Java class name. We can check this requirement by using the following two Java methods:

```java
SourceVersion.isIdentifier(fileName) && !SourceVersion.isKeyword(fileName)
```

__The final data set consists of 1,369,558 class names__ (which are 48% of the files in all repositories).

## Java Source Sets

A convention is to organize Java sources into source sets using the directory format `/src/$sourceSetName/java`/, to distinguish, for example, productive and test code. 

In the sample are __76% of the Java files structured in source sets__. 94% are under `/src/`.

The following table shows the most popular source set names (the full list can be found [here](https://gist.github.com/marcelkliemannel/1568293567513e57562f2b59c7aa997c)):

{{<table "narrow-table">}}
| Source Set Name     | Occurrences |
| ------------------- | ----------- |
| main                | 747396      |
| test                | 267670      |
| gen                 | 10511       |
| generated           | 7945        |
| androidTest         | 5510        |
| net                 | 1862        |
| distributedTest     | 1271        |
| internalClusterTest | 1116        |
| integrationTest     | 1108        |
| it                  | 1060        |
| testIntegration     | 875         |
| com                 | 797         |
| test.slow           | 668         |
| jmh                 | 559         |
| testFixtures        | 526         |
| test-fast           | 488         |
| test-integration    | 376         |
| integration-test    | 314         |
| ext                 | 249         |
| acceptanceTest      | 199         |
{{</table>}}

Unsurprisingly, `main` and `test` are at the top. However, the wide variation in the test source sets is interesting.

## Package Names

Let's first look at the packages of the classes in the sample. We will use the subset of the classes organized in source sets not to mix up the package name with the outer folders.

The package names have a __median of 31 characters__ (50% are below or above this point) and an __average of 32.2__. The following diagram shows the overall distribution:

![numberOfCharactersInPackageNames](numberOfCharactersInPackageNames.svg#center)

A package name usually consists of several subpackages. The sample has __median of 5 subpackages__, and an __average of 4.7__. We can see a more detailed distribution in the following diagram:

![numberOfSubPackagesInClassNames](numberOfSubpackagesInClassNames.svg#center)

The conversion is that the first two subpackages represent a domain (e.g., `org.company`). And with each subpackage, the categorization becomes more fine-grained. If we take this format as a basis, we see either no categorization or at least three categories in the distribution. That 1 and 2 categories are rare is very interesting.

## Class Name Lengths

The lengths of the class names range from 1 character (here, we find the whole alphabet, mostly in test sources) up to 136 characters. The prize for the longest name goes to the [Kubernetes Java Client](https://github.com/kubernetes-client/java/blob/f20788272291c0e79a8c831d8d5a7dd94d96d2de/client-java-contrib/cert-manager/src/main/java/io/cert/manager/models/V1alpha2IssuerSpecAcmeHttp01IngressPodTemplateSpecAffinityNodeAffinityRequiredDuringSchedulingIgnoredDuringExecutionNodeSelectorTerms.java) with:

```java
V1alpha2IssuerSpecAcmeHttp01IngressPodTemplateSpecAffinityNodeAffinityRequiredDuringSchedulingIgnoredDuringExecutionNodeSelectorTerms
```

If we look at the class names over 60 characters, they are almost exclusively names of test classes containing a detailed test case description. For example:

```java
TomcatSessionBackwardsCompatibilityTomcat8WithOldModulesMixedWithCurrentCanDoPutFromCurrentModuleTest
AtomicReferenceArrayAssert_usingRecursiveFieldByFieldElementComparator_with_RecursiveComparisonConfiguration_Test
WildFlyActivationRaWithWMElytronSecurityDomainWorkManagerElytronDisabledTestCase
Assertions_sync_assertThatRuntimeException_with_BDDAssertions_and_WithAssertions_Test
```

Next, let's take a look at the distribution of lengths. The __median length is 18 characters.0__, and the __average is 18.72__. By plotting the distribution, we can see an excellent normal distribution:

![numberOfCharacterInClassNames](numberOfCharacterInClassNames.svg#center)

Interesting is the __peak at 15 characters__. This length could be a good sweet spot for a proper class name length.

## Character Set

The Java specification allows the use of almost the entire Unicode spectrum for class names (an exception is, for example, the `-` character). In contrast, it is interesting that in our sample, __98% use only Latin characters and numbers__ (matching the regex `^[a-zA-Z0-9]+$`). And if we include the two characters `_` and `$`, we get 99.99%.

The obvious interpretation of these numbers is, that the most popular Java GitHub repositories are maintained mainly by an English-speaking developer base.

(It would be interesting to analyze [Gitee](https://gitee.com/)'s character set, the Chinese GitHub equivalent. A cursory look at the top Java repositories shows that Chinese gets used for the documentation (e.g., JavaDoc), but the code mainly uses also only Latin characters).

## Pascal Case

A widely used convention is to use the Pascal case notation for class names. Single words are concatenated and separated in this format by capitalizing the first letter. In our sample data, 97.3% of class names follow the strict Pascal case convention (matching the regular expression `^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$`).

The deviators can be found mainly in the test sources (primarily by using the postfix `_Test`) and the generated sources (these class names often start with a lowercase character).

## Number of Words

The class names that follow the Pascal notation have a __median of 3 words__ and an __average of 3.36__. The full distribution can be seen in the following diagram:

![numberOfWordsInClassNames](numberOfWordsInClassNames.svg#center)

## Plurals

Do we call a class that contains `static` utility methods `XyzUtil` or `XyzUtils`? In our sample set, 11,771 class names have the postfix `Util` and 16,075 the plural `Utils`.

The next question is whether we should use the plural form for a component that manages multiple instances of an entity. For example, is it `UserManager` or `UsersManager`?

We use the following methodology to make a statistical survey of this difference. First, we create a new class name by inserting a `s` before each capital letter in the original name. Then we check if the new name occurs more than once in the sample set. This approach gives us a pretty strong result: __the singular form of an entity gets used much more frequently than its plural counterpart__.

The following table shows a selection of the results:

{{<table "narrow-table">}}
| Singular         | Occurrences | Plural            | Occurrences |
| ---------------- | ----------- | ----------------- | ----------- |
| UserController   | 340         | UsersController   | 4           |
| UserService      | 306         | UsersService      | 2           |
| UserRepository   | 167         | UsersRepository   | 1           |
| UserServiceImpl  | 141         | UsersServiceImpl  | 1           |
| FileUtil         | 132         | FilesUtil         | 2           |
| UserApi          | 119         | UsersApi          | 4           |
| DateUtils        | 95          | DatesUtils        | 1           |
| OrderService     | 95          | OrdersService     | 2           |
| TestHelper       | 72          | TestsHelper       | 4           |
| ViewUtils        | 65          | ViewsUtils        | 1           |
| OrderServiceImpl | 60          | OrdersServiceImpl | 2           |
| ImageUtils       | 59          | ImagesUtils       | 1           |
| EventHandler     | 56          | EventsHandler     | 1           |
| PersonRepository | 56          | PersonsRepository | 2           |
| ResourceUtils    | 56          | ResourcesUtils    | 4           |
| CommonUtils      | 54          | CommonsUtils      | 1           |
| BookRepository   | 49          | BooksRepository   | 2           |
| ColorUtils       | 48          | ColorsUtils       | 1           |
| ResourceLoader   | 47          | ResourcesLoader   | 3           |
| ArrayUtil        | 46          | ArraysUtil        | 2           |
| PluginManager    | 46          | PluginsManager    | 3           |
{{</table>}}

## Abbreviations

An ongoing controversy with class names is the upper and lower case spelling of abbreviations. If we interpret the Pascal Case notation strictly and consider an abbreviation as one word, we would have to capitalize only the first letter (e.g., `Sql` instead of `SQL`).

It would require a more significant effort to approach a general statement about the ratio of both spellings in the dataset since we would have to work with a more complex statistical model. Therefore, we will limit the analysis to getting a rough overview of the distribution in the sample.

First, we need a list of all abbreviations in all class names. To find them, we need to search for all the class names' substrings which contain at least three upper case characters. We then drop the last letter (because this is the beginning of a new word) and get the abbreviation. For example, from `MySQLManager`, we would find the substring `SQLM` which then results in the abbreviation `SQL`. Finally, we reduce the resulting list to the commonly known terms to focus on more accurate results.

We start by counting how many times an uppercase abbreviation occurs in all class names and in how many repositories.

Next, for the lowercase variant, we have to put in more effort. First, we use the regular expression `^.*LOWER_APPR[s]?([A-Z0-9_$]+.*)?$` to find all occurrences of an abbreviation that are followed by a capital letter (e.g., `ApiService`), number (e.g., `Http2Handler`), or special character. Also, we allow an optional plural use of the abbreviation,e.g., `ApisService`. The restriction given by the regular expression is necessary because we want to find `Ui` in `UiManager` but not in `Uint8Array`. However, this is also too restrictive since, e.g., `Sqlite` would also be filtered out. Therefore, we have to go manually through all class names that contain a lowercase abbreviation but do not match the regular expression and add them to the result.

This approach yields the following overview of total occurrences and in how many repositories they occur:

{{<table "narrow-table">}}
| Upper | Occur. | Repos. | Lower | Occur. | Repos. |
| ----- | ------ | ------ | ----- | ------ | ------ |
| SQL   | 5964   | 228    | Sql   | 6752   | 246    |
| HTTP  | 628    | 99     | Http  | 10479  | 621    |
| API   | 1886   | 223    | Api   | 6839   | 478    |
| DB    | 5457   | 358    | Db    | 2607   | 277    |
| XML   | 2757   | 173    | Xml   | 3140   | 315    |
| UI    | 4730   | 374    | Ui    | 571    | 134    |
| DAO   | 899    | 64     | Dao   | 2938   | 211    |
| IO    | 2877   | 431    | Io    | 710    | 116    |
| JDBC  | 967    | 77     | Jdbc  | 2579   | 170    |
| URL   | 1521   | 252    | Url   | 1756   | 403    |
| DTO   | 1861   | 91     | Dto   | 1277   | 81     |
| VM    | 2382   | 147    | Vm    | 342    | 37     |
| OS    | 2027   | 222    | Os    | 414    | 98     |
| SSL   | 1449   | 162    | Ssl   | 957    | 130    |
| URI   | 482    | 114    | Uri   | 1591   | 212    |
| HTML  | 695    | 86     | Html  | 1251   | 188    |
| AST   | 1179   | 63     | Ast   | 423    | 43     |
| LDAP  | 251    | 32     | Ldap  | 873    | 64     |
| JMS   | 379    | 16     | Jms   | 730    | 34     |
| CSV   | 383    | 84     | Csv   | 705    | 95     |
| JVM   | 291    | 59     | Jvm   | 661    | 103    |
| CI    | 794    | 134    | Ci    | 48     | 16     |
| FTP   | 315    | 21     | Ftp   | 497    | 32     |
| HDFS  | 216    | 30     | Hdfs  | 556    | 44     |
| UDF   | 661    | 19     | Udf   | 106    | 11     |
| CDI   | 273    | 20     | Cdi   | 358    | 21     |
| AWS   | 192    | 23     | Aws   | 410    | 38     |
| ARM   | 393    | 16     | Arm   | 69     | 15     |
| AES   | 209    | 62     | Aes   | 151    | 49     |
| APPLE | 15     | 1      | Apple | 320    | 34     |
| JAXRS | 121    | 10     | Jaxrs | 190    | 15     |
| APK   | 15     | 8      | Apk   | 294    | 60     |
| ISO   | 191    | 42     | Iso   | 99     | 38     |
| AMQP  | 61     | 8      | Amqp  | 175    | 16     |
| ASCII | 77     | 29     | Ascii | 155    | 71     |
| CRUD  | 53     | 22     | Crud  | 159    | 36     |
| AWT   | 182    | 29     | Awt   | 29     | 15     |
| MIDI  | 50     | 2      | Midi  | 129    | 9      |
| HANA  | 69     | 3      | Hana  | 100    | 4      |
| HDR   | 78     | 13     | Hdr   | 38     | 15     |
| CDC   | 25     | 11     | Cdc   | 87     | 6      |
| JAXWS | 75     | 4      | Jaxws | 15     | 4      |
| IAM   | 69     | 9      | Iam   | 19     | 6      |
| GMS   | 53     | 4      | Gms   | 14     | 8      |
| UTC   | 30     | 15     | Utc   | 37     | 16     |
{{</table>}}

(For interpreting the numbers, it should be clarify again that the methodology used has some imprecision and is not an exact science).

Interestingly, the occurrences between individual abbreviations sometimes vary greatly. On the one hand, we have abbreviations like `SQL/Sql` that are almost in equilibrium, and on the other hand, some like `HTTP/Http` show a glaring imbalance.

## Popular Prefixes and Postfixes

It's common to give class names stereotypical prefixes or postfixes.

We can extract [over 4700 prefixes](https://gist.github.com/marcelkliemannel/27306557c9e926053df209d9be2adc1c) using the regular expression `^([A-Z][a-z0-9]+)[A-Z]+.*$` from the class names that follow the Pascal notation. The following table shows the most common ones:

{{<table "narrow-table">}}
| Prefix      | Occurrences | Repositories |
| ----------- | ----------- | ------------ |
| Test        | 41507       | 866          |
| Abstract    | 17321       | 822          |
| Default     | 11733       | 820          |
| Base        | 6852        | 981          |
| User        | 6690        | 579          |
| File        | 6533        | 782          |
| My          | 6462        | 573          |
| Simple      | 6299        | 808          |
| Data        | 5784        | 624          |
| Get         | 5330        | 344          |
| Http        | 5118        | 518          |
| String      | 4338        | 714          |
| Web         | 4105        | 493          |
| Custom      | 3989        | 680          |
| Client      | 3957        | 343          |
| Ifc         | 3853        | 1            |
| Class       | 3832        | 416          |
| Multi       | 3616        | 518          |
| Input       | 3596        | 298          |
| Spring      | 3567        | 261          |
| Grid        | 3437        | 146          |
| Json        | 3373        | 477          |
| Message     | 3170        | 423          |
| Local       | 3139        | 455          |
| Mock        | 3040        | 306          |
| Type        | 3038        | 344          |
| Commerce    | 3021        | 2            |
| Job         | 2993        | 153          |
| Server      | 2984        | 355          |
| Java        | 2945        | 352          |
| Main        | 2935        | 1084         |
| Query       | 2930        | 307          |
| Map         | 2911        | 417          |
| App         | 2865        | 448          |
| Event       | 2851        | 376          |
| Service     | 2851        | 365          |
| Basic       | 2808        | 413          |
| List        | 2792        | 515          |
| Cache       | 2780        | 342          |
| Resource    | 2778        | 390          |
| Rest        | 2739        | 189          |
| Sql         | 2737        | 187          |
| Config      | 2735        | 380          |
| No          | 2722        | 514          |
| Create      | 2684        | 291          |
| Method      | 2652        | 317          |
| Open        | 2650        | 278          |
| Object      | 2613        | 435          |
| Application | 2587        | 570          |
| Request     | 2586        | 398          |
{{</table>}}

Similarly, we can extract [over 2200 postfixes](https://gist.github.com/marcelkliemannel/f50318ec7bada2d5b05f51e9e369f89c) using the regular expression `^.*[A-Z][a-z0-9]+([A-Z][a-z0-9]+)$`. The most common ones can be seen in the following table:

{{<table "narrow-table">}}
| Prefix        | Occurrences | Repositories |
| ------------- | ----------- | ------------ |
| Test          | 182596      | 1605         |
| Impl          | 28125       | 818          |
| Tests         | 24745       | 386          |
| Factory       | 21902       | 975          |
| Exception     | 19745       | 1018         |
| Service       | 17703       | 908          |
| Utils         | 14418       | 1241         |
| Handler       | 13984       | 939          |
| Provider      | 13835       | 773          |
| Type          | 12641       | 803          |
| Activity      | 11357       | 1203         |
| Manager       | 11182       | 968          |
| Util          | 10691       | 1025         |
| Builder       | 10355       | 726          |
| Listener      | 10348       | 1055         |
| Controller    | 9119        | 594          |
| Config        | 9056        | 770          |
| Action        | 8363        | 349          |
| Info          | 7958        | 757          |
| View          | 7461        | 917          |
| Event         | 7351        | 511          |
| Adapter       | 7159        | 1007         |
| Filter        | 6920        | 658          |
| Helper        | 6866        | 893          |
| Configuration | 6838        | 506          |
| Request       | 6729        | 482          |
| Context       | 6534        | 583          |
| Mapper        | 6289        | 412          |
| Case          | 6279        | 225          |
| Node          | 6063        | 384          |
| Processor     | 5766        | 516          |
| Description   | 5701        | 147          |
| Fragment      | 5659        | 563          |
| Parser        | 5523        | 616          |
| Model         | 5059        | 473          |
| Response      | 4986        | 401          |
| Repository    | 4958        | 290          |
| Data          | 4827        | 647          |
| Converter     | 4650        | 442          |
| Resource      | 4617        | 292          |
| Generator     | 4545        | 543          |
| Function      | 4534        | 309          |
| Command       | 4512        | 271          |
| Application   | 4490        | 602          |
| Bean          | 4344        | 314          |
| Client        | 4340        | 553          |
| Task          | 4293        | 495          |
| Reader        | 4162        | 418          |
| Source        | 4009        | 475          |
| Result        | 3974        | 603          |
{{</table>}}

## Recurring Class Names

Besides commonly used prefixes and postfixes, seeing how many class names reoccur in multiple repositories is also interesting.

The following table shows the most reccuring class names in all repositories in the sample data (we can find a complete list of all class names occurring more than ten times in more than ten repositories [here](https://gist.github.com/marcelkliemannel/4cc6f0fc9c0c2843115db43d47477cc3)):

{{<table "narrow-table">}}
|Class name             |Occurrences|Repositories|
|-----------------------|-----------|------------|
|Solution               |2375       |14          |
|MainActivity           |1862       |872         |
|User                   |1225       |314         |
|Main                   |1078       |231         |
|Application            |1064       |147         |
|ExampleUnitTest        |853        |323         |
|Utils                  |836        |424         |
|Person                 |723        |149         |
|ApplicationTest        |687        |313         |
|Constants              |674        |341         |
|Test                   |546        |106         |
|Util                   |531        |230         |
|ExampleInstrumentedTest|489        |199         |
|HelloController        |487        |43          |
|App                    |486        |171         |
|Order                  |464        |125         |
|Client                 |408        |124         |
|A                      |401        |55          |
|Foo                    |401        |81          |
|UserController         |340        |121         |
|Node                   |338        |190         |
|Address                |338        |100         |
|Message                |320        |195         |
|TestUtils              |318        |187         |
|UserService            |306        |132         |
{{</table>}}
