<template>
  <select v-model="localValue" @change="onChange">
    <option value="0">无</option>
    <option value="1">1品</option>
    <option value="2">2品</option>
    <option value="3">3品</option>
    <option value="4">4品</option>
    <option value="5">5品</option>
    <option value="6">6品</option>
    <option value="7">7品</option>
    <option value="8">8品</option>
    <option value="9">9品</option>
    <option value="10">10品</option>
    <option value="11">11品</option>
    <option value="12">12品</option>
    <option value="13">13品</option>
    <option value="14">14品</option>
    <option value="15">15品</option>
    <option value="16">16品</option>
  </select>
</template>

<script>
export default {
  name: "CapoSelector",
  data() {
    return {
      localValue: 0,
    }
  },
  props: {
    value: {
      type: Number,
      default: 0,
    }
  },
  created() {
    this.localValue = this.value
  },
  methods: {
    onChange() {
      const v = parseInt(this.localValue)
      this.$emit("update:value", v)
    }
  }
};

</script>