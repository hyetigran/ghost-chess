import type { ImageSourcePropType } from 'react-native';

// Metro needs each require() call site literal (no dynamic template path),
// so this is an explicit map rather than a computed `require(...)` string.
const IMAGES: Record<string, ImageSourcePropType> = {
  wp: require('../../../assets/images/wp.png'),
  wn: require('../../../assets/images/wn.png'),
  wb: require('../../../assets/images/wb.png'),
  wr: require('../../../assets/images/wr.png'),
  wq: require('../../../assets/images/wq.png'),
  wk: require('../../../assets/images/wk.png'),
  bp: require('../../../assets/images/bp.png'),
  bn: require('../../../assets/images/bn.png'),
  bb: require('../../../assets/images/bb.png'),
  br: require('../../../assets/images/br.png'),
  bq: require('../../../assets/images/bq.png'),
  bk: require('../../../assets/images/bk.png'),
};

export function pieceImage(piece: {
  type: string;
  color: string;
}): ImageSourcePropType | undefined {
  return IMAGES[`${piece.color}${piece.type}`];
}
