## The Idea
- HTML is great because it's easy to learn and extremely accessible. But HTML has shortcomings when it comes to building interfaces with interactivity. 
- Lots of libraries have emerged to address these shortcomings - react, vue etc. These libraries are great but they:
  - Have a high learning curve when it comes to code patterns and tooling.
  - Are primarily suited for interfaces with *lots* of interactivity.
- Mini JS lets you build interfaces with moderate amounts of interactivity without needing a heavyweight, javascript-centered library. Because it follows the same patterns as html, it doesn't require learning lots of new  concepts. It's designed to be extremely minimal and learnable within an afternoon.
- The key idea is that if we have 1. A way to set state when an interaction happens (e.g a user clicks a button or types in an input), and 2. A way to update other parts of the UI when those variables change, we can now easily do a range of things we previously couldn't do. Technically vanilla HTML can already do (1), but it can't do (2). 

## Setting State

`State` are variables that changes the UI or the DOM that uses it when they get updated. 

### Setting Initial State

You can set the initial state of the variables using vanilla JS:

```html
<script type="text/javascript">
  firstName = "Tony"
  lastName = "Ennis"
</script>
```

For class names, you can set the initial state by using the `class` attribute:

```html
<!-- Initial state - class="active"
     Dynamic state - :class="" -->
<div class="active" 
  :class="showCode ? 'active' : ''"
></div>
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
  firstName = "Tony"
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

## Events

You can create, use, and update state variables inside DOM events.

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

- `:clickout` - This will trigger when the user clicks outside of the current element
- `:change` - This will trigger when the user changes the value of a form input
- `:enter` - This will trigger when the user presses the enter key
- `:keyup.up` - This will trigger when the user presses the up arrow key
- `:keyup.down` - This will trigger when the user presses the down arrow key
- `:keyup.left` - This will trigger when the user presses the left arrow key
- `:keyup.right` - This will trigger when the user presses the right arrow key


## Statements

- :each - loop through an array and render a template for each item

## Variable

### Variable Scoping

Whenever you create a variable, it will automatically be added to the global scope. This means that you can access it anywhere in your code.

```html
<script type="text/javascript">
  firstName = "Tony"
</script>

<button :click="console.log(firstName)">Click Me</button>
```

If you want to create a local variable, instead of using `const`, `var`, and `let` variable declarations, you need use `el.`:
  
```html
<script>
  items = ["Tag 1", "Tag 2", "Tag 3", "Tag 4"]
  selectedItem = null
</script>

<button :click="el.lastItem = items.pop();
                selectedItem = `Last Item: ${el.lastItem}`"
        :text="selectedItem"
>
  Click Me
</button>
```

### Variable Methods

MiniJS added some commonly-used custom methods to variables.

### Array

Here are the custom array methods which are available for you to use:

- `first` - returns the first item in the array.
  Usage: `array.first`
  ```js
  array = ['Cherries', 'Chocolate', 'Blueberry', 'Vanilla']
  array.last // returns 'Vanilla'
  ```
- `last` - returns the last item in the array.
  Usage: `array.last`
  ```js
  array = ['Cherries', 'Chocolate', 'Blueberry', 'Vanilla']
  array.first // returns 'Cherries'
  ```
- `search` - returns an array of items that match the query.
  Usage: `array.search('query')`
  ```js
  array = ['Cherries', 'Chocolate', 'Blueberry', 'Vanilla']
  array.search('c') // returns ['Cherries', 'Chocolate']
  ```
- `toggle`
  Usage: `array.toggle('item')`
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
- `nextItem` - gets the next item in the array.
  Usage: `array.nextItem('item')`
  ```js
  array = ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4']
  array.nextItem('Tag 2') // returns 'Tag 3'
  ```
- `previousItem` - gets the next item in the array.
  Usage: `array.previousOf('item')`
  ```js
  array = ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4']
  array.previousItem('Tag 2') // returns 'Tag 1'
  ```

To trigger a re-render you need to update the variable:

```js
// Will not trigger a re-render
filteredTags.remove('Chocolates')

// Will trigger a re-render due to re-assignment of the
// filteredTags variable.
filteredTags = filteredTags.remove('Chocolates')
```
