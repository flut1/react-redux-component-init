# react-redux-component-init
A library to manage react component initialization in isomorphic applications using [Redux.js](http://redux.js.org).

## When to use
This library is designed for usage in large-scale react applications with server-side rendering. It can also be used in smaller applications or application without server-side rendering. However, in these use cases a less complex solution might be more appropriate.

### prerequisites
This library will only work for applications that have the following setup:
 - A react+redux setup with server-side rendering. Redux state on the server should be injected into the client as initial state (as described in [the Redux documentation](http://redux.js.org/docs/recipes/ServerRendering.html))
 - A Redux store configured with the [redux-thunk](https://github.com/gaearon/redux-thunk) middleware
 - Support for Promises on both the server and client side

## Motivation
In a react application, we often want to perform a certain action when a component mounts. These actions are often asynchonous (like loading some data from an api). More specifically, in isomorphic applications (with server side rendering) we often want these actions to be completed before we start rendering the page. In order to achieve this, we have two alternatives:
 - **Component-based approach:** We define the initialization actions on each component. This comes with a problem: the server does not know which components are mounted before a react render has completed. This would mean we have to do at least 2 render calls: one to figure out which components need to be initialized, and another after initialization actions have completed.
 - **Top-down approach:** We define all initialization on the page level. This can get messy very quickly, because a page has to have knowledge about the data needs of all descendant components. It is easy to make a mistake and do too little or too much initialization. Moreover, it can lead to code duplication between pages.

This library aims to provide utilities to make the *component based approach* a feasible solution. It allows us to define initialization on each component without having to do more than one render.

## Core concepts
Below is a general explanation of the implementation for this library. For quick setup instructions, see "Setup" below.

### Initialization lifecycle
 - **Server side** on the server, we don't start rendering until all components have been initialized.
   1. **Set `initMode`** the `initMode` is initially set to `MODE_PREPARE` to indicate that we want to initialize components before we mount them.
   2. **Component prepare** Before we start rendering, we need to call the initialization action of every component configured with `withInitAction()`. We refer to this as "preparing a component" and this can be done using the `prepareComponent()` action. For more info see "The prepare tree" below.
_Note: components configured with `allowLazy` may skip this step. For more info see the `withInitAction()` docs below_
   3. **Wait for preparation to complete** Before we render our page, we need to wait for the preparation to complete. This can be done using the promise returned by `prepareComponent()`
   4. **Render** Our page can now be rendered. To make sure we never skip an initialization action, all components configured with `withInitAction()` will throw an error if mounted without preparing it first.
 - **Client side** on the client, we don't want to redo initialization that has already been done on the server. When new components mount (for example, on client-side navigation), they should be initialized as well.
   1. **First render** this is essentially the same as step 4 on the server side. All component preparation has already been done on the server.
   2. **Set `initMode`** we dispatch `setInitMode(MODE_INIT_SELF)` to indicate that new components should initialize themselves as soon as they mount.
   3. **Next render(s)** If a new component wrapped in `withInitAction()` mounts, it will automatically initialize. Additionally, a component can also be configured to re-initialize if its `props` update.
_Note: By default, the component will start rendering even if the `initAction` has not completed yet. For more info see the `withInitAction()` docs below._

### The prepare tree
As described in "initialization lifecycle" above, we need to dispatch `prepareComponent()` for each component on the page before page render. But how do we know in advance which components will be on our page? The trick is to configure our page component initialization to dispatch `prepareComponent()` for each direct child component with an `initAction`. We configure the child component initialization to dispatch `prepareComponent()` for their children, and so on. This way, we only have to dispatch `prepareComponent()` on the page component we want to render and it will recursively prepare its descendants.

![The prepare tree](https://github.com/mediamonks/react-redux-component-init/raw/develop/docs/assets/prepare-tree.png)

#### Example
Below is an example of a `HomePage` component layout. We will need to load the notifications to display in the header, the list of posts, and some detail data for each post.

![Example homepage](https://github.com/mediamonks/react-redux-component-init/raw/develop/docs/assets/example-homepage.png)

We use `withInitAction()` to add the following initialization to our components:
 - `Homepage` calls `prepareComponent(Header)` and `prepareComponent(HomeTimeline)`
 - `Header` calls `prepareComponent(HeaderNotifications)`
 - `HeaderNotifications` loads the notifications for the current user
 - `HomeTimeline` loads a list of posts. It now has a couple of post ids and calls `prepareComponent(Post, { id: postId })` for each post
 - `Post` loads some detail data to display the itself

![Example prepare tree](https://github.com/mediamonks/react-redux-component-init/raw/develop/docs/assets/example-prepare-tree.png?v=3)

_NOTE: In this example, the list of posts are loaded separately from the post detail data. In another application this might be a single call_

## Setup
Make sure you have an existing setup with the prerequisites listed above.

#### Attach the reducer
Attach the `react-redux-component-init` reducer to your Redux store under the `init` key. The easiest way to do this is by using [Redux combineReducers()](http://redux.js.org/docs/api/combineReducers.html):
```
import { combineReducers, createStore } from 'redux';
import { initReducer as init } from 'react-redux-component-init';

const mainReducer = combineReducers({
  init: initReducer,
  // ... other reducers in the application
});
const store = createStore(mainReducer);
```
Please note: it is recommended to attach the reducer to the `init` key, but it is also possible to include the reducer elsewhere in the state. See the `getInitState` option of the `withInitAction()` HoC.

#### Server side page rendering
In the function that renders your page on the server, call `prepareComponent` with the page components you will render before you render your page. The example below is using [express](https://expressjs.com/) and [react-router](https://github.com/ReactTraining/react-router) 3, but these are not required.
```
import { prepareComponents } from 'react-redux-component-init';
import { match, RouterContext } from 'react-router';
import { Provider } from 'react-redux';
import { renderToString } from 'react-dom/server';
...
function renderPage(req, res) {
  ...
  match({ routes: Routes, location: req.url }, (error, redirectLocation, renderProps) => {
    ...
    // note: prepareComponents is just a shorthand for multiple prepareComponent() wrapped in Promise.all()
    store.dispatch(prepareComponents(
      renderProps.routes.map(route => route.component),
      renderProps
    )).then(() => {
      res.send(renderToString(
        <Provider store={store}>
          <RouterContext {...renderProps} />
        </Provider>
      );
    });
  });
}
```
#### Set initMode on client
On the client side of your application you should switch the initMode to `MODE_INIT_SELF` **after the first render**.
```
import { setInitMode, MODE_INIT_SELF } from 'react-redux-component-init';
...
store.dispatch(setInitMode(MODE_INIT_SELF));
```

## API Documentation
### `withInitAction([initProps], initAction, [options])(Component)`
Higher-order component that adds initialization configuration to an existing component.
 - `initProps` `{Array<string>}` _(optional)_ An array of names of `props` that are relevant for initialization.
   - Only the values of these props are available in the `initAction` function
   - On component mount, a value is required for each of these props
   - The values that these props will have on mount need to be provided to `prepareComponent()`
   - Component preparation using `withPrepare()` only executes once for each combination of these props. Duplicate calls (with the same `Component` and the same values for `initProps`) will be ignored.
   - By default, if these props change value on the client, the component will "re-initialize". See `options` below
   - Dot notation can be used to define a subset of an object prop. For example, when using `['foo.bar', 'foo.foobar']` the `initAction`  will only get the properties `bar` and `foobar` on the `foo` prop.
 - `initAction` `{(props, dispatch, getState) => Promise}` This is the actual initialization function. This function **must return a Promise** that resolves when initialization is complete. It receives the following arguments:
   - `props` `{object}` An object containing values of the props defined in `initProps`. If `initProps` is not defined, this is an empty object.
   - `dispatch` `{function}` The Redux dispatch function. This can be used to dispatch initialization actions or dispatch the `withPrepare()` action for child components
   - `getState` `{function}` The Redux getState function.
 - `options` `{object}` _(optional)_ An object containing additional options:
   - `allowLazy` If `true`, no error will be thrown when the component is mounted without being prepared using `prepareComponent()` first. Instead, the `initAction` will be performed on `componentDidMount` on the client, as if it wasn't mounted on first render. This can be used to do non-critical initialization, like loading data for components that display below the fold. _Defaults to `false`_
   - `reinitialize` If `true`, will call `initAction` again if any of the props defined in `initProps` change after mount. This change is checked with strict equality (===) _Defaults to `true`_
   - `initSelf` A string that indicates the behavior for initialization on the client (`initMode == MODE_INIT_SELF`). Possible values:
     - `"ASYNC"` _(default)_ the component will render immediately, even if `initAction` is still pending. It is recommended to use this option and render a loading indicator or placeholder content until `initAction` is resolved. This will give the user immediate feedback that something is being loaded. While the `initAction` is pending, an `isInitializing` prop will be passed to the component.
     - `"BLOCKING"` this will cause this higher-order component not tot mount the target component until the first initialization has completed. The component will remain mounted during further re-initialization.
     - `"UNMOUNT"` same as `"BLOCKING"` but it will also unmount the component during re-initialization.
     - `"NEVER"` will only initialize on the server (`initMode == MODE_PREPARE`). Initialization will be skipped on the client.
   - `onError` Error handler for errors in `initAction`.  If given, errors will be swallowed.
   - `getPrepareKey` A function that generates a "prepare key" that will be used to uniquely identify a component and its props. It has the following signature:
  ```({string} componentId, {Array} propsArray) => {string}```
  This defaults to a function that concatenates the `componentId` and the stringified `propsArray`. In most cases, this will ensure that a component instance on the server is matched to the corresponding instance on the client. However, if the props are somehow always different between server and client, you may use this function to generate a key that omits that difference.
   - `getInitState` A function that takes the Redux state and returns the init state of the reducer from this module. By default, it is assumed the state is under the `init` property. If the reducer is included elsewhere, this function can be set to retrieve the state.

#### example
```
// PostComponent.js
class Post extends React.Component {
 ...
}

export default withInitAction(
  ['id'],
  ({ id }, dispatch) => dispatch(loadPostData(id)),
  { allowLazy: true }
)(Post);

// PostPage.js
import Post from './components/PostComponent';
...
class PostPage extends React.Component {
  ...
  render() {
    ...
    <Post id={this.props.location.query.postId} />
    ...
  }
}

export default withInitAction(
  ['location.query'],
  ({ location: { query } }) => dispatch(prepareComponent(Post, { id: query.postId }))
)(PostPage);
```

### `prepareComponent(Component, props)`
Action creator to prepare a component for rendering on the server side (`initMode == MODE_PREPARE`). Should be passed to the Redux dispatch function. Returns a Promise that resolves when preparation is complete
 - `Component` `{react.Component}` The component that should be prepared. This should be a component returned by the `withInitAction` higher-order component. If no `withInitAction` wrapper is around the Component, dispatching this action will have no effect.
 - `props` `{object}` The props to prepare the component with. These should be the same props as you expect to pass when you eventually render component. It should at least include the props configured in the `initProps` array of `withInitAction`.

### `prepareComponents(components, props)`
A shorthand action creator for multiple `prepareComponent` calls with the same `props`. Returns a Promise that resolves when preparation for all components is complete
 - `components` `{Array<react.Component>}` An array of components to prepare
 - `props` `{object}` The props to prepare with

### `setInitMode(initMode)`
An action creator to switch the `initMode` of the application. Should be called with `MODE_INIT_SELF` after the initial render on the client.
 - `initMode` `{string}` Either of the modes `MODE_PREPARE` or `MODE_INIT_SELF` as defined in the `initMode` export of this module
