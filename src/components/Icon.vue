<script setup lang="ts">
withDefaults(defineProps<{name:string;size?:number}>(),{size:18})
const paths:Record<string,string[]>={
 chart:['M3 3v18h18','m7 14 4-4 4 3 6-8'],grid:['M3 3h7v7H3z','M14 3h7v7h-7z','M3 14h7v7H3z','M14 14h7v7h-7z'],
 wallet:['M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6','M20 12h-5v4h5'],
 bell:['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9','M10 21h4'],settings:['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8','m9 3 1-1h4l1 3 3 2 3 1v4l-3 1-2 3-1 3h-4l-1-3-3-2-3-1V9l3-1 2-3z'],
 plus:['M12 5v14','M5 12h14'],search:['M21 21l-5-5','M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14'],refresh:['M20 8a8 8 0 0 0-14-3L3 8','M3 3v5h5','M4 16a8 8 0 0 0 14 3l3-3','M21 21v-5h-5'],
 arrowUp:['m5 12 7-7 7 7','M12 5v14'],arrowDown:['m5 12 7 7 7-7','M12 5v14'],chevron:['m9 5 7 7-7 7'],
 download:['M12 3v12','m7 10 5 5 5-5','M4 16v5h16v-5'],upload:['M12 16V3','m7 8 5-5 5 5','M4 16v5h16v-5'],
 close:['m6 6 12 12','M18 6 6 18'],check:['m5 12 4 4L19 6'],star:['m12 3 2.8 5.7L21 10l-4.5 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 10l6.2-1.3z'],
 dots:['M5 12h.01','M12 12h.01','M19 12h.01'],folder:['M3 7V4h6l2 3h10v14H3z'],trash:['M3 6h18','M9 6V3h6v3','M5 6l1 15h12l1-15','M10 10v7','M14 10v7'],
 edit:['m15 5 4 4','m3 21 1-6L16 3l5 5L9 20z'],shield:['m12 3 9 4v6c0 6-9 9-9 9s-9-3-9-9V7z','m8 12 3 3 5-6'],
 info:['M12 8h.01','M12 11v5','M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20'],external:['M14 3h7v7','m21 3-9 9','M10 3H3v18h18v-7'],pause:['M8 5v14','M16 5v14'],play:['m8 4 12 8-12 8z'],
 sun:['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8','M12 2v2','M12 20v2','M2 12h2','M20 12h2','m5 5 1 1','m18 18 1 1','m5 19 1-1','m18 6 1-1'],clock:['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20','M12 6v6l4 2'],
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="(path,i) in paths[name]||paths.chart" :key="i" :d="path"/></svg></template>
