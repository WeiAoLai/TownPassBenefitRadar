/**
 * 長輩圖文字樣式。數值以字級為單位（0.26 = 字級的 26%），任何解析度都維持相同比例。
 * 筆畫由寬到窄依序畫，最後才填色，做出「外白框、內深框、亮色字」的經典長輩圖效果。
 */
export interface TextStyle {
  id: string
  name: string
  /** 單色或由上到下的漸層色 */
  fill: string | string[]
  strokes: { color: string; width: number }[]
  /** 外光暈或陰影，只套在最外層筆畫 */
  glow?: { color: string; blur: number }
}

export const TEXT_STYLES: TextStyle[] = [
  {
    id: 'red-orange',
    name: '紅橘白邊',
    fill: ['#FF2A00', '#FF9500'],
    strokes: [{ color: '#FFFFFF', width: 0.28 }],
    glow: { color: 'rgba(0,0,0,0.35)', blur: 0.12 },
  },
  {
    id: 'gold-blue',
    name: '金黃藍邊',
    fill: ['#FFF76A', '#FFD000'],
    strokes: [{ color: '#0A1F8F', width: 0.22 }],
  },
  {
    id: 'blue-glow',
    name: '寶藍白光',
    fill: '#1F33FF',
    strokes: [{ color: '#FFFFFF', width: 0.26 }],
    glow: { color: '#FFFFFF', blur: 0.4 },
  },
  {
    id: 'pink-white',
    name: '桃紅白邊',
    fill: '#FF1493',
    strokes: [{ color: '#FFFFFF', width: 0.28 }],
    glow: { color: 'rgba(0,0,0,0.3)', blur: 0.1 },
  },
  {
    id: 'rainbow',
    name: '七彩繽紛',
    fill: ['#FF2D2D', '#FF9F1A', '#FFE81A', '#2BD94A', '#1A8CFF', '#B94DFF'],
    strokes: [
      { color: '#3A1A00', width: 0.36 },
      { color: '#FFFFFF', width: 0.2 },
    ],
  },
  {
    id: 'gold-red',
    name: '金字喜氣',
    fill: ['#FFF8C2', '#FFC800', '#E08A00'],
    strokes: [
      { color: '#8E0000', width: 0.34 },
      { color: '#FFE9A8', width: 0.14 },
    ],
  },
  {
    id: 'green-white',
    name: '翠綠白邊',
    fill: ['#3CF07A', '#009E3A'],
    strokes: [{ color: '#FFFFFF', width: 0.28 }],
    glow: { color: 'rgba(0,0,0,0.3)', blur: 0.1 },
  },
  {
    id: 'white-black',
    name: '白字黑邊',
    fill: '#FFFFFF',
    strokes: [{ color: '#111111', width: 0.24 }],
  },
]

export const styleById = (id: string) => TEXT_STYLES.find((s) => s.id === id) ?? TEXT_STYLES[0]

export type FontKey = 'sans' | 'serif' | 'kai'

export const FONTS: { key: FontKey; name: string; family: string; weight: number }[] = [
  {
    key: 'sans',
    name: '粗黑體',
    family: '"Noto Sans TC Variable","PingFang TC","Microsoft JhengHei",sans-serif',
    weight: 900,
  },
  {
    key: 'serif',
    name: '明體',
    family: '"Noto Serif TC Variable","Songti TC","PMingLiU",serif',
    weight: 900,
  },
  {
    key: 'kai',
    name: '楷書',
    family: '"LXGW WenKai TC","Kaiti TC","BiauKai","DFKai-SB",cursive',
    weight: 700,
  },
]

export const fontByKey = (k: FontKey) => FONTS.find((f) => f.key === k) ?? FONTS[0]

export const GREETINGS = ['早安', '午安', '晚安', '平安喜樂', '天天開心', '身體健康', '出入平安', '感恩\n有你']
