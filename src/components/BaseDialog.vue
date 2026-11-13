<script setup lang="ts">
import { ref,onMounted,onBeforeUnmount,nextTick,useId } from 'vue'
import Icon from './Icon.vue'
defineProps<{title:string;subtitle?:string;wide?:boolean}>()
const emit=defineEmits<{close:[]}>(),dialog=ref<HTMLElement|null>(null),titleId=useId()
let previous:HTMLElement|null=null
const controls=()=>Array.from(dialog.value?.querySelectorAll<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href],[tabindex="0"]')||[]).filter(el=>!el.hidden)
function keydown(event:KeyboardEvent){
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();emit('close');return}
 if(event.key!=='Tab')return
 const all=controls();if(!all.length){event.preventDefault();dialog.value?.focus();return}
 const first=all[0]!,last=all[all.length-1]!
 if(event.shiftKey && (document.activeElement===first || !dialog.value?.contains(document.activeElement))){event.preventDefault();last.focus()}
 else if(!event.shiftKey && (document.activeElement===last || !dialog.value?.contains(document.activeElement))){event.preventDefault();first.focus()}
}
onMounted(async()=>{previous=document.activeElement as HTMLElement;await nextTick();const first=dialog.value?.querySelector<HTMLElement>('[autofocus],input,select,textarea')||controls()[0];(first||dialog.value)?.focus()})
onBeforeUnmount(()=>previous?.focus())
</script>
<template>
 <Teleport to="body"><div class="dialog-backdrop" @mousedown.self="emit('close')"><section ref="dialog" class="dialog" :class="{wide}" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" @keydown="keydown">
  <header class="dialog-heading"><div><h2 :id="titleId">{{title}}</h2><p v-if="subtitle">{{subtitle}}</p></div><button class="icon-button" aria-label="关闭对话框" @click="emit('close')"><Icon name="close"/></button></header>
  <slot/>
 </section></div></Teleport>
</template>
