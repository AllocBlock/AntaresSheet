<template>
  <div class="error" ref="error" :style="`font-size: ${fontSize}px`">?</div>
</template>

<script>
export default {
  name: "FretChordGraphError",
  data() {
    return {
      fontSize: 12
    }
  },
  mounted() {
    this.updateFontSize()
  },
  methods: {
    updateFontSize() {
      let e = this.$refs['error']
      let MinEdge = Math.min(e.clientWidth, e.clientHeight)
      this.fontSize = MinEdge * 0.8
    }
  }
}
</script>

<style scoped>
.error{
  width: 100%;
  height: 100%;
	font-size: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
	overflow: hidden;
	color: rgba(255, 0, 0, 0.5);
}
</style>