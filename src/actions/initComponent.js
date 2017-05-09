import propNameValuesToObject from '../utils/propNameValuesToObject';
import { MODE_INIT_SELF, MODE_PREPARE } from '../initMode';
import { INIT_SELF_NEVER } from '../initSelfMode';

import { INIT_COMPONENT } from './actionTypes';

/**
 * Action that initializes a single Component. Can be used both during a component prepare
 * and a component self-init.
 *
 * If the current `initMode` is `MODE_PREPARE` and the component has not yet initialized
 * when this action is dispatched, an error will be thrown.
 *
 * **There is probably no need to directly use this action outside of this module.** This
 * action is automatically dispatched by the `withInitAction()` HoC and the `prepareComponent()`
 * thunk.
 *
 * @param {react.Component} Component The React component to initialize. Passing a component that
 * was not wrapped with `withInitAction()` will result in an error.
 * @param {Array} initValues An array of values that correspond with the array of `initProps` for
 * this component. These values are either passed through `prepareComponent()` or extracted from
 * the `props` when a component mounts or updates.
 * @param {string} prepareKey A unique identifier for the component and it's `initValues`. This
 * is generated by the `getPrepareKey()` util.
 * @param {object} [options] Additional options
 * @param {boolean} [options.isPrepare = false] True if a component is being prepared, false
 * if a component is being mounted or updated.
 * @returns {function} A thunk function that should be passed directly to the Redux `dispatch`
 * function.
 */
export default (
  Component,
  initValues,
  prepareKey,
  { isPrepare = false } = {},
) => (dispatch, getState) => {
  if (!Component.initConfig) {
    throw new Error('No init config found on Component passed to initComponent');
  }

  const {
    componentId,
    initProps,
    initAction,
    options: { onError, getInitState, initSelf },
  } = Component.initConfig;

  const initState = getInitState(getState());
  if (!initState) {
    throw new ReferenceError('Could not find init state. Did you attach the init reducer?');
  }
  const { mode, prepared } = initState;

  if (
    ((mode === MODE_INIT_SELF) && (initSelf !== INIT_SELF_NEVER)) ||
    (isPrepare && (typeof prepared[prepareKey] === 'undefined'))
  ) {
    const initPropsObj = propNameValuesToObject(initProps, initValues);

    dispatch({
      type: INIT_COMPONENT,
      payload: {
        complete: false,
        isPrepare,
        prepareKey,
      },
    });

    return Promise.resolve()
      .then(() => {
        const initActionReturn = initAction(initPropsObj, dispatch, getState);

        if (typeof initActionReturn.then !== 'function') {
          const error = new Error(`Expected initAction to return a Promise. Returned an ${typeof initActionReturn} instead. Check the initAction for "${componentId}"`);
          error.isInvalidReturnError = true;
          throw error;
        }

        return initActionReturn;
      })
      .catch((e) => {
        if (onError && !e.isInvalidReturnError) {
          onError(e);
        } else {
          throw e;
        }
      })
      .then((result) => {
        dispatch({
          type: INIT_COMPONENT,
          payload: {
            complete: true,
            isPrepare,
            prepareKey,
          },
        });

        return result;
      });
  } else if (mode === MODE_PREPARE && !isPrepare) {
    if (typeof prepared[prepareKey] === 'undefined') {
      const initPropsObj = propNameValuesToObject(initProps, initValues);
      throw new Error(`Expected component "${componentId}" to be prepared but prepareComponent has not been called with props: \n${JSON.stringify(initPropsObj)}`);
    } else if (prepared[prepareKey] === false) {
      throw new Error(`Expected component "${componentId}" to be prepared but preparation is still pending`);
    }
  }

  return Promise.resolve();
};
