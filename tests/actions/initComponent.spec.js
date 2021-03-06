/* global expect, describe, it, jest */
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import initComponent from '../../src/actions/initComponent';
import withInitAction, { clearComponentIds } from '../../src/withInitAction';
import { MODE_PREPARE } from '../../src/initMode';
import SimpleInitTestComponent from '../fixtures/SimpleInitTestComponent';
import {
  modeInitSelfAndNothingPrepared,
  modePrepareAndNothingPrepared,
  modePrepareAndSimplePreparedNoProps, modePrepareAndSimplePreparePendingNoProps
} from '../fixtures/storeState';

const mockStore = configureMockStore([thunk]);

describe('initComponent', () => {
  describe('when initMode === MODE_PREPARE', () => {
    describe("with { caller: 'willMount' }option given", () => {
      describe('and no prepare state is present', () => {
        describe('with no allowLazy option on the component', () => {
          clearComponentIds();
          const store = mockStore(modePrepareAndNothingPrepared);
          const MockWithInit = withInitAction(() => Promise.resolve())(SimpleInitTestComponent);

          it('throws an error', () => {
            expect(() =>
              store.dispatch(
                initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                  caller: 'willMount',
                }),
              ),
            ).toThrow();
          });
        });
        describe('with { allowLazy: true } on the component', () => {
          it('does not throw an error', () => {
            clearComponentIds();
            const store = mockStore(modePrepareAndNothingPrepared);
            const MockWithInit = withInitAction(() => Promise.resolve(), { allowLazy: true })(
              SimpleInitTestComponent,
            );

            expect(() =>
              store.dispatch(
                initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                  caller: 'willMount',
                }),
              ),
            ).not.toThrow();
          });
        });
      });
      describe('and the preparation has completed', () => {
        describe('with no allowLazy option on the component', () => {
          it('does not throw an error', () => {
            clearComponentIds();
            const store = mockStore(modePrepareAndSimplePreparedNoProps);
            const MockWithInit = withInitAction(() => Promise.resolve())(SimpleInitTestComponent);

            expect(() =>
              store.dispatch(
                initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                  caller: 'willMount',
                }),
              ),
            ).not.toThrow();
          });

          it('does not dispatch INIT_COMPONENT', () => {
            clearComponentIds();
            const store = mockStore(modePrepareAndSimplePreparedNoProps);
            const MockWithInit = withInitAction(() => Promise.resolve())(SimpleInitTestComponent);

            return store
              .dispatch(
                initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                  caller: 'willMount',
                }),
              )
              .then(() => {
                const actions = store.getActions();
                return expect(actions).toEqual([]);
              });
          });
        });

        describe('with { allowLazy: true } on the component', () => {
          it('does not throw an error', () => {
            clearComponentIds();
            const store = mockStore(modePrepareAndSimplePreparedNoProps);
            const MockWithInit = withInitAction(() => Promise.resolve(), { allowLazy: true })(
              SimpleInitTestComponent,
            );

            expect(() =>
              store.dispatch(
                initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                  caller: 'willMount',
                }),
              ),
            ).not.toThrow();
          });

          it('does not dispatch INIT_COMPONENT', () => {
            clearComponentIds();
            const store = mockStore(modePrepareAndSimplePreparedNoProps);
            const MockWithInit = withInitAction(() => Promise.resolve(), { allowLazy: true })(
              SimpleInitTestComponent,
            );

            return store
              .dispatch(
                initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                  caller: 'willMount',
                }),
              )
              .then(() => {
                const actions = store.getActions();
                return expect(actions).toEqual([]);
              });
          });

          it('does not call the initAction', () => {
            clearComponentIds();
            const store = mockStore(modePrepareAndSimplePreparedNoProps);
            const mockInitAction = jest.fn(
              () => new Promise(resolve => setTimeout(() => resolve('bar'), 40)),
            );
            const MockWithInit = withInitAction(mockInitAction, { allowLazy: true })(
              SimpleInitTestComponent,
            );

            return store
              .dispatch(
                initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                  caller: 'willMount',
                }),
              )
              .then(() => expect(mockInitAction.mock.calls.length).toBe(0));
          });
        });
      });
      describe('and the preparation in state is still pending', () => {
        clearComponentIds();
        const store = mockStore(modePrepareAndSimplePreparePendingNoProps);
        const MockWithInit = withInitAction(() => Promise.resolve())(SimpleInitTestComponent);

        it('throws an error', () => {
          expect(() =>
            store.dispatch(
              initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', { caller: 'willMount' }),
            ),
          ).toThrow();
        });
      });
      describe('and the preparation is done with different props', () => {
        clearComponentIds();
        const store = mockStore({
          init: {
            mode: MODE_PREPARE,
            prepared: {
              'SimpleInitTestComponent["foo"]': true,
            },
          },
        });
        const MockWithInit = withInitAction(['p1'], () => Promise.resolve())(
          SimpleInitTestComponent,
        );

        it('throws an error', () => {
          expect(() =>
            store.dispatch(
              initComponent(MockWithInit, ['bar'], 'SimpleInitTestComponent["bar"]', {
                caller: 'willMount',
              }),
            ),
          ).toThrow();
        });
      });
    });
    describe("with { caller: 'didMount' }option given, no prepare state present and { allowLazy: true }", () => {
      it('calls the initAction and dispatches { complete: true } when the action resolves', () => {
        clearComponentIds();
        const store = mockStore(modePrepareAndNothingPrepared);
        const MockWithInit = withInitAction(() => Promise.resolve(), { allowLazy: true })(
          SimpleInitTestComponent,
        );

        return store
          .dispatch(
            initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', { caller: 'didMount' }),
          )
          .then(() => {
            const actions = store.getActions();
            expect(actions).toMatchSnapshot();
          });
      });
    });
    describe("with {caller: 'prepareComponent'}", () => {
      describe('and no prepare state is present', () => {
        describe('with no allowLazy option on the component', () => {
          it('dispatches INIT_COMPONENT with { complete: false }', () => {
            clearComponentIds();
            const store = mockStore(modePrepareAndNothingPrepared);
            const MockWithInit = withInitAction(
              () => new Promise(resolve => setTimeout(() => resolve('bar'), 40)),
            )(SimpleInitTestComponent);
            store.dispatch(
              initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                caller: 'prepareComponent',
              }),
            );

            const actions = store.getActions();
            expect(actions).toMatchSnapshot();
          });

          it('calls the initAction and dispatches { complete: true } when the action resolves', () => {
            clearComponentIds();
            const store = mockStore(modePrepareAndNothingPrepared);
            const mockInitAction = jest.fn(
              () => new Promise(resolve => setTimeout(() => resolve('bar'), 40)),
            );
            const MockWithInit = withInitAction(mockInitAction)(SimpleInitTestComponent);
            const initPromise = store.dispatch(
              initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                caller: 'prepareComponent',
              }),
            );

            return initPromise.then(() => {
              const actions = store.getActions();
              expect(actions).toMatchSnapshot();

              expect(mockInitAction.mock.calls.length).toBe(1);
            });
          });
        });
        describe('with { allowLazy: true } on the component', () => {
          it('dispatches INIT_COMPONENT with { complete: false }', () => {
            clearComponentIds();
            const store = mockStore(modePrepareAndNothingPrepared);
            const MockWithInit = withInitAction(
              () => new Promise(resolve => setTimeout(() => resolve('bar'), 40)),
              { allowLazy: true },
            )(SimpleInitTestComponent);
            store.dispatch(
              initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                caller: 'prepareComponent',
              }),
            );

            const actions = store.getActions();
            expect(actions).toMatchSnapshot();
          });
        });
      });
      describe('with an initAction that rejects', () => {
        clearComponentIds();
        const store = mockStore(modePrepareAndNothingPrepared);
        const MockWithInit = withInitAction(
          () => new Promise((resolve, reject) => setTimeout(() => reject('bar'), 40)),
        )(SimpleInitTestComponent);

        it('rejects the return promise', () =>
          expect(
            store.dispatch(
              initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
                caller: 'prepareComponent',
              }),
            ),
          ).rejects.toBe('bar'));
      });
      describe('with an initAction that rejects and an error handler', () => {
        clearComponentIds();
        const store = mockStore(modePrepareAndNothingPrepared);
        const mockErrorHandler = jest.fn();
        const MockWithInit = withInitAction(
          () => new Promise((resolve, reject) => setTimeout(() => reject('bar'), 40)),
          { onError: mockErrorHandler },
        )(SimpleInitTestComponent);
        const initPromise = store.dispatch(
          initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
            caller: 'prepareComponent',
          }),
        );

        it('resolves the returned promise', () => expect(initPromise).resolves.toBeUndefined());
        it('calls the error handler with the rejected value', () =>
          expect(mockErrorHandler).toBeCalledWith('bar'));
      });
      describe('and prepare is already in progress', () => {
        clearComponentIds();
        const store = mockStore(modePrepareAndSimplePreparePendingNoProps);
        const mockInitAction = jest.fn(
          () => new Promise(resolve => setTimeout(() => resolve('bar'), 40)),
        );
        const MockWithInit = withInitAction([], mockInitAction)(SimpleInitTestComponent);
        const initPromise = store.dispatch(
          initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', {
            caller: 'prepareComponent',
          }),
        );

        it('does not call the initAction', () =>
          initPromise.then(() => expect(mockInitAction.mock.calls.length).toBe(0)));

        it('does not dispatch INIT_COMPONENT', () =>
          initPromise.then(() => {
            const actions = store.getActions();
            expect(actions).toEqual([]);
          }));
      });
    });
  });
  describe('when initMode === MODE_INIT_SELF', () => {
    describe('with an async initAction', () => {
      it('dispatches INIT_COMPONENT with { complete: false }', () => {
        clearComponentIds();
        const store = mockStore(modeInitSelfAndNothingPrepared);
        const MockWithInit = withInitAction(
          () => new Promise(resolve => setTimeout(() => resolve('bar'), 40)),
        )(SimpleInitTestComponent);
        store.dispatch(
          initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', { caller: 'willMount' }),
        );

        const actions = store.getActions();
        expect(actions).toMatchSnapshot();
      });

      it('dispatches { complete: true } when the action resolves', () => {
        clearComponentIds();
        const store = mockStore(modeInitSelfAndNothingPrepared);
        const MockWithInit = withInitAction(
          () => new Promise(resolve => setTimeout(() => resolve('bar'), 40)),
        )(SimpleInitTestComponent);
        const initPromise = store.dispatch(
          initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', { caller: 'willMount' }),
        );

        return initPromise.then(() => {
          const actions = store.getActions();
          expect(actions).toMatchSnapshot();
        });
      });

      it('resolves with the resolved value of the action', () => {
        clearComponentIds();
        const store = mockStore(modeInitSelfAndNothingPrepared);
        const MockWithInit = withInitAction(
          () => new Promise(resolve => setTimeout(() => resolve('bar'), 40)),
        )(SimpleInitTestComponent);
        const initPromise = store.dispatch(
          initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', { caller: 'willMount' }),
        );

        return initPromise.then(result => expect(result).toBe('bar'));
      });
    });
  });
  describe('on a component with custom getInitState', () => {
    clearComponentIds();
    const store = mockStore({
      foo: { mode: MODE_PREPARE, prepared: { 'SimpleInitTestComponent[]': true } },
    });
    const MockWithInit = withInitAction(() => Promise.resolve(), {
      getInitState: state => state.foo,
    })(SimpleInitTestComponent);

    it('runs without error', () => {
      expect(() =>
        store.dispatch(
          initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', { caller: 'willMount' }),
        ),
      ).not.toThrow();
    });
  });
  describe('with an initAction that does not return a Promise', () => {
    clearComponentIds();
    const store = mockStore(modeInitSelfAndNothingPrepared);
    const MockWithInit = withInitAction(() => 5)(SimpleInitTestComponent);

    it('rejects the returned promise', () => {
      expect(
        store.dispatch(
          initComponent(MockWithInit, [], 'SimpleInitTestComponent[]', { caller: 'willMount' }),
        ),
      ).rejects.toBeDefined();
    });
  });
});
