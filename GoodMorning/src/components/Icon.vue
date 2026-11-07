<script setup lang="ts">
/** 線條風格圖示（對齊 TownPass 底部導覽的描邊圖示）；裝飾用途，一律 aria-hidden */
const props = withDefaults(defineProps<{ name: string; size?: number; filled?: boolean }>(), { size: 24, filled: false })

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 8.8V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V8.8',
  brush: 'M14.5 4.5l5 5M4 20l1.2-4.4L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8 4 20z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.6 3.9-6 7.5-6s6.7 2.4 7.5 6',
  heart: 'M12 20.3s-7.5-4.5-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.6-7.5 10.1-7.5 10.1z',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2.5-2.5L20 17M15.5 9.5h.01',
  text: 'M5 6V4.5h14V6M12 4.5v15M9 19.5h6',
  palette: 'M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.6 0-1.2-1-1.4-1-2.5 0-.9.7-1.6 1.6-1.6h2.1a4 4 0 0 0 4-4C20.5 6.6 16.7 3.5 12 3.5zM7.5 12h.01M9.5 8h.01M14.5 8h.01',
  flag: 'M5.5 21V4M5.5 4.5h11l-2 3.5 2 3.5h-11',
  lock: 'M6.5 10.5h11v9.5h-11zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2',
  check: 'M5 12.5 10 17l9-10',
  'chevron-right': 'M9.5 5.5 16 12l-6.5 6.5',
  'chevron-left': 'M14.5 5.5 8 12l6.5 6.5',
  close: 'M6 6l12 12M18 6 6 18',
  share: 'M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v7.5h14V12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.5H15',
  move: 'M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5',
  // 直書：三行由上往下，下方箭頭；橫書：三行由左往右，右側箭頭
  vertical: 'M17 3v10M12 3v10M7 3v6M9 18l3 3 3-3M12 21v-5',
  horizontal: 'M3 7h10M3 12h10M3 17h6M18 9l3 3-3 3M21 12h-5',
  'align-left': 'M4 6h16M4 10h10M4 14h16M4 18h10',
  'align-center': 'M4 6h16M7 10h10M4 14h16M7 18h10',
  'align-right': 'M4 6h16M10 10h10M4 14h16M10 18h10',
  'align-top': 'M6 4v16M10 4v10M14 4v16M18 4v10',
  'align-middle': 'M6 4v16M10 7v10M14 4v16M18 7v10',
  'align-bottom': 'M6 4v16M10 10v10M14 4v16M18 10v10',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5zM10 20.5a2 2 0 0 0 4 0M12 3v2',
  camera: 'M4 7.5h3.5L9 5h6l1.5 2.5H20v11.5H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  medal: 'M8 3h3l1 4M16 3h-3M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 12.5v4',
  volume: 'M4 9.5v5h3.5l4.5 4V5.5l-4.5 4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11',
  /* 同一個功能用同一個圖示（台北通 PD）：還原／重來用 undo、儲存用 save、定位用 pin、動畫用 sparkle */
  undo: 'M9 7 4.5 11.5 9 16M4.5 11.5H14a5.5 5.5 0 0 1 0 11',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  pin: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  'volume-off': 'M4 9.5v5h3.5l4.5 4V5.5l-4.5 4H4zM16 9.5l5 5M21 9.5l-5 5',
  pause: 'M8.5 5v14M15.5 5v14',
  play: 'M8 5.5v13l11-6.5z',
}
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
    class="icon"
  >
    <path
      :d="PATHS[props.name] ?? ''"
      :fill="props.filled ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.icon {
  flex: none;
  display: block;
}
</style>
