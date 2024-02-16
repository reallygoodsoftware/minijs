# MiniJS

## Installation

To setup MiniJS in your local machine, you can do the following:

1. Clone the [repository](https://github.com/Group-One-Technology/minijs).
2. Run `npm install` to install dependencies.
3. Run `npm run build` to create the `dist` folder -> output for MiniJS.
4. Run `npm run dev` to run the demo page locally.
5. Run `npm run build-watch` on another terminal to build the code whenever the Mini.js code changes.

## The Idea

- HTML is great because it's easy to learn and extremely accessible. But HTML has shortcomings when it comes to building interfaces with interactivity.
- Lots of libraries have emerged to address these shortcomings - react, vue etc. These libraries are great but they:
  - Have a high learning curve when it comes to code patterns and tooling.
  - Are primarily suited for interfaces with _lots_ of interactivity.
- Mini JS lets you build interfaces with moderate amounts of interactivity without needing a heavyweight, javascript-centered library. Because it follows the same patterns as html, it doesn't require learning lots of new concepts. It's designed to be extremely minimal and learnable within an afternoon.
- The key idea is that if we have 1. A way to set state when an interaction happens (e.g a user clicks a button or types in an input), and 2. A way to update other parts of the UI when those variables change, we can now easily do a range of things we previously couldn't do. Technically vanilla HTML can already do (1), but it can't do (2).

## Setting State

`State` are variables that changes the UI or the DOM that uses it when they get updated.

Note: Only non-nested objects are supported for reactive state.

### Setting Initial State

You can set the initial state of the variables using vanilla JS:

```html
<script type="text/javascript">
  firstName = 'Tony'
  lastName = 'Ennis'
</script>
```

### Syncing the DOM with your state

These are the following attributes that you can use to sync the DOM with your state:

- `:value`
  - Set the value of a form input to a JS variable which stays in sync when that variable changes.
  - Works with the following input types: text, textarea, select, datepicker.
- `:class`
  - Set the class of any DOM element based on the value of a js variable.
- `:text`
  - Set the text of any DOM element based on the value of a js variable.

```html
<script type="text/javascript">
  firstName = 'Tony'
</script>

<input type="text" :change="firstName = this.value" />

<!-- The innerText of this paragraph changes based on the firstName variable -->
<p :text="firstName"></p>
```

### Triggering DOM Updates / Re-renders

A DOM update or a re-render happens when the state variable is re-assigned:

```html
<input type="text" :change="firstName = this.value" />
<!-- the re-assignment of firstName will trigger DOM updates that uses that variable -->
```

## Dynamic Attributes

Besides `:value`, `:class`, and `:text`, you can also use the make **any** attribute dynamic by renaming it from `attribute` to `:attribute`. Values set to dynamic attributes are evaluated as JavaScript:

```html
<script>
  pStyle = 'color: red'
</script>

<p :style="pStyle">My style is changing</p>
<button
  :click="if (pStyle === 'color: red')
						pStyle = 'color: blue';
					else
						pStyle = 'color: red'"
>
  Toggle Style
</button>
```

## Classes

You can make your class names reactive by using the `:class` attribute:

```html
<script type="text/javascript">
  isActive = false
</script>

<button :click="isActive = !isActive" :class="isActive ? 'active' : ''">
  Click Me
</button>
```

### Setting the Default Classes

To set default classes, you can use the `class` attribute:

```html
<div class="hidden" :class="shouldShow ? 'visible' : 'hidden'"></div>
```

### Setting Multiple Reactive Classes

To set multiple reactive classes, you can use the `:class` attribute:

1. Use multiple ternary operators enclosed in parentheses:

```html
<div
  :class="(selectedTab === 'When' ? 'bg-white shadow-lg' : 'hover:bg-gray-300')
          (whenSelectedTab === 'Dates' ? 'hidden' : '')"
></div>
```

2. Use if-else statements:

```html
<div
  :class="if (selectedTab === 'When') {
            return 'bg-white shadow-lg'
          } else {
            return 'hover:bg-gray-300'
          }

          if (whenSelectedTab === 'Dates') {
            return 'hidden'
          } else {
            return ''
          }"
></div>
```

## Events

You can create, use, and update state variables inside DOM events.

Special variables are available in events:

- `event` - the event object
- `this` - the current element

### Native Events

All native events are supported. You can use them like this:

```html
<button :click="console.log('click')">Click Me</button>
```

You can access the current element in the event via `this`:

```html
<button :click="this.classList.toggle('active')">Click Me</button>

<input :change="this.value = this.value.toUpperCase()" />
```

### Custom Events

These are the events added in by MiniJS:

- `:clickout` - This will trigger when the user clicks outside of the current element.
- `:change` - This will trigger when the user changes the value of a form input.
- `:keyup.up` - This will trigger when the user presses the up arrow key.
- `:keyup.down` - This will trigger when the user presses the down arrow key.
- `:keyup.left` - This will trigger when the user presses the left arrow key.
- `:keyup.right` - This will trigger when the user presses the right arrow key.
- `:keyup.enter` - This will trigger when the user presses "Enter".
- `:keyup.space` - This will trigger when the user presses "Space".
- `:press` - This will trigger when the user:
  - triggers the `click` event.
  - triggers the `keyup.enter` and `keyup.space` events.
  - triggers the `touchstart` event.

### Keyboard Events

For keyboard events, you can listen to them using `:keyup`, `:keydown`, and `:keypress`:

```html
<input type="text" :keyup="console.log(event)" />
```

#### Key Modifiers

You can also use key modifiers to listen to specific keys. Modifiers are appended to the event name using a dot:

```html
<input
  type="text"
  :keyup.up="console.log('keyup.up')"
  :keydown.enter="console.log('keydown.enter')"
/>
```

You can chain multiple key modifiers together:

```html
<input type="text" :keydown.slash.k="console.log('keydown.slash.k')" />
```

For key values that have multiple words like `BracketLeft`, except for arrow keys, kebab case is used:

```html
<input
  type="text"
  :keydown.bracket-left="console.log('keydown.bracket-left')"
/>
```

The following are the available key modifiers:

| Type                               | Key Value                          | Modifier                       | Usage                                               |
| ---------------------------------- | ---------------------------------- | ------------------------------ | --------------------------------------------------- |
| Digits (0-9)                       | Digit1, Digit2                     | 1, 2                           | :keyup.1, :keyup.2                                  |
| Letters (A-Z, a-z)                 | KeyA, KeyB                         | a, b                           | :keyup.a, :keyup.b                                  |
| Numpad (0-9)                       | Numpad1, Numpad2                   | 1, 2                           | :keyup.1, :keyup.2                                  |
| Arrow Keys (up, down, left, right) | ArrowLeft, ArrowRight              | left, right                    | :keyup.left, :keyup.right                           |
| Meta (left, right)                 | Meta, MetaLeft, MetaRight          | meta, meta-left, meta-right    | :keyup.meta, :keyup.meta-left, :keyup.meta-right    |
| Alt (left, right)                  | Alt, AltLeft, AltRight             | alt, alt-left, alt-right       | :keyup.alt, :keyup.alt-left, :keyup.alt-right       |
| Control (left, right)              | Control, ControlLeft, ControlRight | ctrl, ctrl-left, ctrl-right    | :keyup.ctrl, :keyup.ctrl-left, :keyup.ctrl-right    |
| Shift (left, right)                | Shift, ShiftLeft, ShiftRight       | shift, shift-left, shift-right | :keyup.shift, :keyup.shift-left, :keyup.shift-right |
| Symbols (., /, =, etc.)            | Period, BracketLeft, Slash         | period, bracket-left, slash    | :keyup.period, :keyup.bracket-left, :keyup.slash    |

> Note: If you don't know the "name" of a symbol key, you can use the `console.log(event.code)` to see the key value. Example for the "Enter" key: `:keyup="console.log(event.code)"` will log "Enter". So you can use `:keyup.enter` to listen to the "Enter" key.

---

## Statements

### Each Statement

The `:each` statement is used to loop through an array and render a template for each item.

```html
<script>
  items = ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4']
</script>

<ul :each="item in items">
  <li :text="item"></li>
</ul>

<ul :each="item, index in items">
  <li :text="item"></li>
</ul>
```

You can also use complex variables for the `:each` statement:

```html
<script>
  items = [
    { name: 'Tag 1', id: 1 },
    { name: 'Tag 2', id: 2 },
    { name: 'Tag 3', id: 3 },
    { name: 'Tag 4', id: 4 },
  ]
</script>

<ul :each="item in items">
  <li :text="item.name"></li>
</ul>
```

## Variables

### Variables saved in Local Storage

Appending `$` to the variable name will save the variable in the local storage:

```html
<script type="text/javascript">
  $firstName = 'Tony'
</script>

<input type="text" :change="$firstName = this.value" />
```

Note: Currently, this is only available for globally declared variables.

### Variable Scoping

#### Global Variables

Whenever you create a variable, it will automatically be added to the global scope. This means that you can access it anywhere in your code.

```html
<script type="text/javascript">
  firstName = 'Tony'
</script>

<button :click="console.log(firstName)">Click Me</button>
```

#### Local Variables

To use variables only in a current event, you can create a local variable using `const`, and `let`:

```html
<button
  :click="const time = new Date();
          window.alert(time.toLocaleTimeString())"
>
  Click Me
</button>
```

### Element Variables

If you want to use the variable across an element's attributes and events, you can use `el.`:

```html
<script>
  items = ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4']
</script>

<button
  :load="el.selectedItem = items.pop()"
  :click="el.selectedItem = items.pop()"
  :text="`Last Item: ${el.selectedItem}`"
>
  Click Me
</button>
```

Like the example above, `:load` can be used to set the initial value of the variable.

### Parent Element Variables

Adding a `:parent` attribute to an element will allow you to access its variables from its children using `parent.` variables.

A children's `parent.` variable is the same as the parent's `el.` variable.

```html
<div id="accordion" class="accordion" :parent>
  <!-- Parent Element -->

  <!-- Children Elements -->
  <!-- parent.variable == #accordion's el.variable -->
  <section
    class="grid transition-all border-gray-300 border border-b-0 rounded hover:bg-gray-100"
  >
    <button
      :click="parent.activeSection = 'about'"
      class="cursor-pointer font-bold p-4"
    >
      About Us
    </button>
    <div
      class="p-4 pt-2 overflow-hidden hidden"
      :class="parent.activeSection =='about' ? 'block' : 'hidden'"
    >
      Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy
      eirmod.
    </div>
  </section>

  <section
    class="grid transition-all border-gray-300 border border-b-0 rounded hover:bg-gray-100"
  >
    <button
      :click="parent.activeSection = 'contact'"
      class="cursor-pointer font-bold p-4"
    >
      Contact Us
    </button>
    <div
      class="p-4 pt-2 overflow-hidden"
      :class="parent.activeSection =='contact' ? 'block' : 'hidden'"
    >
      Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy
      eirmod.
    </div>
  </section>

  <section
    class="grid transition-all border-gray-300 border rounded hover:bg-gray-100"
    :class="parent.activeSection =='team' ? 'active' : ''"
  >
    <button
      :click="parent.activeSection = 'team'"
      class="cursor-pointer font-bold p-4"
    >
      Team 3
    </button>
    <div
      class="p-4 pt-2 overflow-hidden"
      :class="parent.activeSection =='team' ? 'block' : 'hidden'"
    >
      Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy
      eirmod.
    </div>
  </section>
</div>
```

### Variable Methods

MiniJS added some commonly-used custom methods to variables.

### Array

Here are the custom array methods which are available for you to use:

- `first` - returns the first item in the array.
  Usage: `array.first`

  ```js
  array = ['Cherries', 'Chocolate', 'Blueberry', 'Vanilla']
  array.first // returns 'Cherries'
  ```

- `last` - returns the last item in the array.
  Usage: `array.last`

  ```js
  array = ['Cherries', 'Chocolate', 'Blueberry', 'Vanilla']
  array.last // returns 'Vanilla'
  ```

- `search` - returns an array of items that match the query.
  Usage: `array.search('query')`

  ```js
  array = ['Cherries', 'Chocolate', 'Blueberry', 'Vanilla']
  array.search('c') // returns ['Cherries', 'Chocolate']
  ```

- `add` - adds an item to the array if it doesn't exist.
  Usage: `array.add('item')`

  ```js
  array = ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4']
  array.add('Tag 5') // returns ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4', 'Tag 5']
  ```

- `remove` - removes an item from the array if it exists.
  Usage: `array.remove('item')`

  ```js
  array = ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4']
  array.remove('Tag 2') // returns ['Tag 1', 'Tag 3', 'Tag 4']
  ```

- `toggle` - removes / adds the item in the array
  Usage: `array.toggle('item')`

  ```js
  array = ['Cherries', 'Chocolate', 'Blueberry', 'Vanilla']
  array.toggle('Cherries') // removes 'Cherries'
  // returns ['Chocolate', 'Blueberry', 'Vanilla']

  array.toggle('Cherries') // re-adds 'Cherries'
  // returns ['Cherries', 'Chocolate', 'Blueberry', 'Vanilla']
  ```

- `nextItem` - gets the next item based on the given item in the array.
  Usage: `array.nextItem('item')`
  ```js
  array = ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4']
  array.nextItem('Tag 2') // returns 'Tag 3'
  ```
- `previousItem` - gets the next item based on the given item in the array.
  Usage: `array.previousOf('item')`

  ```js
  array = ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4']
  array.previousItem('Tag 2') // returns 'Tag 1'
  ```

#### Triggering Array Updates

To trigger a re-render you need to update the variable:

```js
// Will not trigger a re-render
filteredTags.remove('Chocolates')

// Will trigger a re-render due to re-assignment of the
// filteredTags variable.
filteredTags = filteredTags.remove('Chocolates')
```
