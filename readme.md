## The Idea
- HTML is great because it's easy to learn and extremely accessible. But HTML has shortcomings when it comes to building interfaces with interactivity. 
- Lots of libraries have emerged to address these shortcomings - react, vue etc. These libraries are great but they:
  - Have a high learning curve when it comes to code patterns and tooling.
  - Are primarily suited for interfaces with *lots* of interactivity.
- HTML Plus lets you build interfaces with moderate amounts of interactivity without needing a heavyweight, javascript-centered library. Because it follows the same patterns as html, it doesn't require learning lots of new  concepts. It's designed to be extremely minimal and learnable within an afternoon.
- The key idea is that if we have 1. A way to set state when an interaction happens (e.g a user clicks a button or types in an input), and 2. A way to update other parts of the UI when those variables change, we can now easily do a range of things we previously couldn't do. Technically vanilla HTML can already do (1), but it can't do (2). 

## Setting State

Set state with 

Set variables with vanilla JS
```
<script type="text/javascript">
  firstName = "Tony"
  lastName = "Ennis"
</script>
```

#### Syncing the dom with your state
- :value
  - Set the value of a form input to a js variable which stays in sync when that variable changes. 
  - Works with the following input types: text, textarea, select, datepicker.
- :class
  - Set the class of any dom element based on the value of a js variable.
- :text
  - Set the text of any dom element based on the value of a js variable.

#### Other
- :each 

#### Variable Methods
- search
- toggle
- add 
- remove
- first
- last

## Tips
- Use `this.value` to get the value of the current form


#### Actions
- :click
- :clickout
- :change
- :enter
- :keypress
- :keydown
- :keyup