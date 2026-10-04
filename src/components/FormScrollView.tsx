import React, { forwardRef, useCallback, useContext, useImperativeHandle, useMemo, useRef } from 'react';
import { Platform, ScrollView, View, type ScrollViewProps } from 'react-native';
import { AuthCardContext } from './web/authCardContext';
import { FormScrollContext, type FormScrollTarget } from '../utils/invalidFields';

/** Space kept above a revealed field, so its label is on screen too. */
const REVEAL_OFFSET = 96;

/**
 * A ScrollView that can bring a field into view: a drop-in replacement for
 * the form's own ScrollView. Fields inside it (through FieldError) use it to
 * scroll the first invalid field into sight on iOS and Android after a
 * failed submit. On the web the browser does that from the DOM, and this
 * behaves exactly like a ScrollView.
 */
export const FormScrollView = forwardRef<ScrollView, ScrollViewProps>(function FormScrollView(props, ref) {
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollView);

  const reveal = useCallback((node: View) => {
    const scroll = scrollRef.current as any;
    const inner = scroll?.getInnerViewRef?.() ?? scroll?.getInnerViewNode?.();
    if (!scroll || !inner || typeof (node as any).measureLayout !== 'function') return;
    try {
      (node as any).measureLayout(
        inner,
        (_x: number, y: number) => scroll.scrollTo({ y: Math.max(0, y - REVEAL_OFFSET), animated: true }),
        () => {},
      );
    } catch {
      // A field that has just unmounted: nothing to reveal.
    }
  }, []);

  const target = useMemo<FormScrollTarget>(() => ({ reveal }), [reveal]);
  const inAuthCard = useContext(AuthCardContext);

  // Inside the desktop sign-in card the card grows to fit and the page
  // scrolls, so a second scroll container here would only add a scrollbar.
  if (inAuthCard && Platform.OS === 'web') {
    return (
      <FormScrollContext.Provider value={target}>
        <View style={[props.style, props.contentContainerStyle]} testID={props.testID}>{props.children}</View>
      </FormScrollContext.Provider>
    );
  }

  return (
    <FormScrollContext.Provider value={target}>
      <ScrollView keyboardShouldPersistTaps="handled" {...props} ref={scrollRef} />
    </FormScrollContext.Provider>
  );
});
