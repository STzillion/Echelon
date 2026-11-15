import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

const UI_SCALE = 0.95;
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

export function createCompactStyleSheet<T extends NamedStyles>(
  styles: T,
  additionalScale = 1,
  excludedStyles: ReadonlySet<string> = new Set()
): T {
  const compactStyles = Object.fromEntries(
    Object.entries(styles).map(([name, style]) => [
      name,
      Object.fromEntries(Object.entries(style).map(([property, value]) => {
        const isLocalDimension =
          additionalScale !== 1 && (property === 'minHeight' || property === 'minWidth');
        const isScaledProperty = SCALED_STYLE_PROPERTIES.has(property);
        if (typeof value !== 'number' || (!isScaledProperty && !isLocalDimension)) {
          return [property, value];
        }

        const compactValue = !isScaledProperty
          ? value
          : property === 'height' || property === 'width'
            ? value >= 44
              ? Math.max(44, value * UI_SCALE)
              : value
            : value * UI_SCALE;

        return [
          property,
          excludedStyles.has(name) ? compactValue : compactValue * additionalScale,
        ];
      })),
    ])
  ) as T;

  return compactStyles;
}
