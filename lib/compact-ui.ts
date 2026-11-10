import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

const UI_SCALE = 0.9;
const SCALED_STYLE_PROPERTIES = new Set([
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'bottom',
  'columnGap',
  'flexBasis',
  'fontSize',
  'gap',
  'height',
  'left',
  'letterSpacing',
  'lineHeight',
  'margin',
  'marginBottom',
  'marginEnd',
  'marginHorizontal',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginTop',
  'marginVertical',
  'maxHeight',
  'maxWidth',
  'padding',
  'paddingBottom',
  'paddingEnd',
  'paddingHorizontal',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingTop',
  'paddingVertical',
  'right',
  'rowGap',
  'top',
  'width',
]);

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function createCompactStyleSheet<T extends NamedStyles>(styles: T): T {
  const compactStyles = Object.fromEntries(
    Object.entries(styles).map(([name, style]) => [
      name,
      Object.fromEntries(
        Object.entries(style).map(([property, value]) => [
          property,
          typeof value === 'number' && SCALED_STYLE_PROPERTIES.has(property)
            ? property === 'height' || property === 'width'
              ? value >= 44
                ? Math.max(44, value * UI_SCALE)
                : value
              : value * UI_SCALE
            : value,
        ])
      ),
    ])
  ) as T;

  return compactStyles;
}
