---
title: "Powerful UI texts with the HTML capable JBLabel"
date: 2021-07-10T10:13:28+02:00
draft: false
tags: ["IntelliJ SDK"]
metaDescription: "Overview about the powerful JBLabel in the IntelliJ SDK, which allows to display HTML, auto wrapping and copyable texts."
---

With the **[JBLabel](https://upsource.jetbrains.com/idea-ce/file/idea-ce-17812b1102973a61b8b73ee7fdbea12cf8036cd6/platform/platform-api/src/com/intellij/ui/components/JBLabel.java)**, the IntelliJ SDK offers a powerful extension of the classic Swing `javax.swing.JLabel` to display texts. The most important extension is the ability to format the text using HTML and CSS. To enable this, we just need to put our text into a simple `<html>` block:

```Java
JBLabel myLabel = new JBLabel("<html>Lorem <b>ipsum</b> dolor sit <i>amet</i>, consectetur <u>adipiscing</u> elit.</html>");
```

The above code results in the following output:

{{< retina-image jblabel-with-html-styling2x.png "JBLabel with HTML Styling" >}}

(Even though omitting the body element is semantically incorrect, we should still do this for the sake of readability in simple cases.)

{{< table-of-contents >}}

## Styling

Because the text for a `JBLabel` can be any ordinary HTML document, we can use CSS to style the text. For more extensive or reusable style definitions, we can write them in a `<style>` block in the `<head>` area, or we can use the inline `style` attribute:

```html
<html>
  <head>
    <style>.highlight { color: #ff0000; }</style>
  </head>
  <body>
    Lorem <span class=\"highlight\">ipsum</span> dolor sit <span style=\"text-decoration: line-through\">amet</span>, consectetur adipiscing elit.
  </body>
</html>
```

Using this HTML document as the text input to a `JBLabel` would lead to the following output:
{{< retina-image jblabel-with-css-styling2x.png "JBLabel with CSS Styling" >}}

### Useful Styling Methods

* Converting a Swing `java.awt.Color` to a CSS hex color: `"color: #" + com.intellij.ui.ColorUtil.toHex(Color.White)` 

* The font family and size of the current IntelliJ theme:
```java
// Also see smallFont(), miniFont() or toolbarFont()
JBFont labelFont = com.intellij.util.ui.JBUI.Fonts.label()
String style = "font-family: '" + labelFont.family + "'; font-size: " + labelFont.size + "pt"
```

- The class `com.intellij.util.ui.JBUI.CurrentTheme` contains most of the current theme colors for various UI commoments.

## Auto wrapping

One of the main advantages over a simple Swing `JLabel` is that `JBLabel` supports auto wrapping, as long as the text is enclosed in a `<html>` block (simple text does not benefit from this ability):

![JBLabel Wrapping](jblabel-wrapping.gif#center)

The auto wrapping is enabled by default and can be disabled via `setAllowAutoWrapping(false)`.

## Copyable Text

The normal Swing `JLabel` does not have the ability that its text is markable and thus copyable. In contrast, a `JBLabel` provides this ability:
{{< retina-image jblabel-copyable2x.png "JBLabel Copyable" >}}

This is archived by setting `JBLabel#setCopyable` to `true`.

### Auto Wrapping with Copyable Text

If we make the label copyable, we lose the ability for the text to have the auto wrapping from the previous chapter. To get this back, we need to style the text using the CSS property `white-space`:

```html
<html>
  <head><style>body { white-space: normal; }</style></head>
  <body>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</body>
</html>
```

## Hyper Links

We can use ordinary web links inside our HTML text, **as long as the label was marked copyable**:

```java
JBLabel myLabel = new JBLabel("<html>Lorem <a href=\"http://google.com\">ipsum</a> dolor sit amet, consectetur <a href=\"http://jetbrains.org\">adipiscing</a> elit.</html>");
myLabel.setCopyable(true); // Important!
```

Internally, `BrowserUtil#open(url)` is used to open the link in the default browser configured in the settings.

### Custom Hyper Link Handling

We can also use links for internal actions, e.g., opening a file dialog. To do this, we first need to implement a `com.intellij.ui.HyperlinkAdapter` and then return an instance of it in our own JBLabel class.

In the following example, we want the link with the target `myAction` to call our own logic:

```java
<html>Lorem <a href="myAction">ipsum</a> dolor.</html>
```

Our implementation of the `HyperlinkAdapter` we need for this simply needs to check the description of the `HyperlinkEvent` to our searched target:

```java
public class MyHyperlinkListener extends HyperlinkAdapter {
  @Override
  public void hyperlinkActivated(HyperlinkEvent e) {
    if (e.getDescription().equals("myAction")) {
      // Handle link with our own logic
      System.out.println("myAction clicked");
    }
    else {
      // Handle link with the original JBLabel logic
      BrowserUtil.open(e.getDescription());
    }
  }
}
```

It is unfortunately not possible (at least until IntelliJ 2021.1) to set a different listener to a `JBLabel`.  Therefore we have to extend the `JBLabel` class, which then returns our `MyHyperlinkListener`:

```java
public class MyJBLabel extends JBLabel {
  private static final MyHyperlinkListener HYPERLINK_LISTENER = new MyHyperlinkListener();
  
  public MyJBLabel(@NotNull @NlsContexts.Label String text) {
    super(text);
    setCopyable(true); // Important!
  }

  @Override
  protected @NotNull HyperlinkListener createHyperlinkListener() {
    return HYPERLINK_LISTENER;
  }
}
```

Unfortunately, the requirement that the link must be copyable to be clickable still remains for our own implementation.

## Images

The `JBLabel` provides us with several ways to display images within HTML text:

### External Image

Like in a regular website, we can load images as HTTP links from an external source:

```java
new JBLabel("<html>Image from link: <img src=\"http://mydomain.com/image.png\" /></html>");
```

This way has a decisive disadvantage: unlike a browser, the image is loaded synchronously. This means that the UI thread is blocked until the image is loaded. If the HTTP link is unreachable or the connection is slow, the entire IntelliJ UI freezes, which is an absolute no-go. It is therefore generally not recommended to include images in this way,

### Bundled Image

Internally, the HTML renderer uses the Java `java.net.URL` class to parse the value of the `src` attribute field. This way, we can load our image via the resource loading mechanism and use them via the path from `URL#toExternalForm()`:

```java
URL resource = TestTool.class.getResource("/icons/image.png")
new JBLabel("<html>Bundled image: <img src=\"" + resource.toExternalForm() + "\" /></html>")
```

### Image on Disk

Through the internal use of `URL`s, we can also load files from the disk by putting `file:` as a protocol in front of the actual path:

```java
new JBLabel("<html>Image from disk: <img src=\"file:/path/to/my/file/image.png\" />");
```

### Embedded Image

With the help of [Data URLs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs), the image content can be embedded into the `src` attribute. The value must be  provided with the following syntax:

```
data:image/<type>;base64,<data>
```

Whereas `<type>` is the subtype of the image [MIME type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types), e.g. `png` or `jpg`, and `<data>` is the [Base64-encoded image](https://codebeautify.org/image-to-base64-converter). A shortened example:

```java
new JBLabel("<html>Embedded image: <img src=\"image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAeGVYSW...aXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoZXuEHAAAAGklEQVQIHWPc7e58o0U46ivTNi7RG0eYuCUAQ8YGnV2hT5kAAAAASUVORK5CYII=\" /></html>");
```

### Built-in Icons

The IntelliJ SDK provides a comprehensive collection of built-in icons located in the [com.intellij.icons.**AllIcons**](https://jetbrains.design/intellij/resources/icons_list/) class. These icons can be accessed using the element `icon`, where the `src` attribute contains as value the reference to the icon field in the `AllIcons` class:

```java
new JBLabel("<html>Build-in icon: <icon src=\"AllIcons.Actions.Edit\" />");
```

## HTML DSL

Writing complex HTML texts by hand can quickly lead to syntactical and semantic errors. Likewise, we may have situations where we want to compute the content dynamically, e.g., a list whose elements are computed at runtime.

The IntelliJ SDK provides us with an HTML DSL in the class **[HtmlChunk](https://upsource.jetbrains.com/idea-ce/file/idea-ce-17812b1102973a61b8b73ee7fdbea12cf8036cd6/platform/util/src/com/intellij/openapi/util/text/HtmlChunk.java)** for this purpose, which can be used to create HTML text programmatically.

For the following HTML text:

```html
<html>
  <head>
    <style>
      .first-row { font-weight: bold; }
      .subsequent-row { font-weight: bold; }
    </style>
  </head>
  <body>
    <ul>
      <li class="first-row">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
      <li class="subsequent-row">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
      8 more subsequent rows...
    </ul>
  </body>
</html>
```

the programmatic generation with the `HtmlChunk` DSL would look like this:

```java
import com.intellij.openapi.util.text.HtmlChunk.*

Element list = ul()
for (int i = 0; i < 10; i++) {
  list.child(li().attr("class", i == 0 ? "first-row" : "subsequent-row")
                 .addText("Lorem ipsum dolor sit amet, consectetur adipiscing elit."))
}

String htmlText = body().child(head().child(styleTag(".first-row { font-weight: bold; }\n" +
                                                     ".subsequent-row { font-weight: bold; }")))
                        .child(body().child(list))
                        .toString()
```

In addition, the class **[HtmlBuilder](https://upsource.jetbrains.com/idea-ce/file/idea-ce-17812b1102973a61b8b73ee7fdbea12cf8036cd6/platform/util/src/com/intellij/openapi/util/text/HtmlBuilder.java)** provides some helper methods when working with HTML texts. In particular, the `append` methods, with which multiple `HtmlChunk`, other `HtmlBuilder`, or plain HTML texts can be connected together. Or wrapper methods for recurring patterns, e.g., `wrapWithHtmlBody`, which encloses the previous element in a `<html><body>...</body></html>` block.
