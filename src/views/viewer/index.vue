<template>
  <div id="viewer" :env="env" :style="globalCssVar">
    <transition name="trans_fade_out">
      <div id="cover" v-show="showLoadCover">
        <div>{{ loadStateString }}</div>
      </div>
    </transition>

    <div id="tools_sheet_control" class="tools_block" v-if="tools.sheetControl.enable">
      <div id="scale_block">
        <div class="tools_text">缩放</div>
        <input
          id="scale_slider"
          type="range"
          step="0.01"
          min="0.2"
          max="2.0"
          v-model="tools.sheetControl.scale"
          @input="changeScale()"
        />
        <div id="scale_text" class="tools_text">{{parseFloat(tools.sheetControl.scale).toFixed(1)}}</div>
      </div>
      <div id="auto_scroll_block">
        <div class="tools_text">自动滚动</div>
        <input
          id="auto_scroll_slider"
          type="range"
          step="0.1"
          min="0"
          max="10"
          v-model="tools.sheetControl.autoScroll.speed"
          @input="changeAutoScrollSpeed()"
        />
        <div id="auto_scroll_text" class="tools_text">{{autoScrollSpeedText}}</div>
      </div>
    </div>

    <Chord id="tip_chord" v-if="env == 'pc' && tools.tipChord.enable" :style="`opacity: ${tools.tipChord.show ? 1 : 0}`" :chord="tools.tipChord.chord" />

    <div id="tools_player" class="tools_block" v-if="tools.player.enable">
      <transition name="trans_fade_out">
        <div id="load_cover" v-show="showPlayerLoadCover">
          <div>{{ toolsPlayerLoadingText }}</div>
        </div>
      </transition>
      <Metronome ref="metronome"/>
      <select id="instrument_combo" v-model="tools.player.instrument.audioSource">
        <option value="Oscillator">合成器音源</option>
        <option value="Ukulele">尤克里里音源</option>
      </select>
    </div>
    
    <div id="sheet">
      <div id="song_title" class="title">{{sheetInfo.title}}</div>
      <div id="song_singer" class="title">{{sheetInfo.singer}}</div>
      <div id="sheet_key_block">
        <div id="sheet_original_key" class="title">{{`原调 ${sheetInfo.originalKey}`}}</div>
        <div id="sheet_current_key" class="title">
          {{`选调 ${sheetInfo.sheetKey}`}}
          <div id="sheet_key_shift">
            <div id="sheet_key_shift_up" @click="shiftKey(1)">▲</div>
            <div id="sheet_key_shift_down" @click="shiftKey(-1)">▼</div>
          </div>
        </div>
        <div id="sheet_capo_block">
          <div class="title">变调夹</div>
          <CapoSelector id="capo_selector" v-model:value="tools.player.instrument.capo"/>
        </div>
      </div>
      <div id="sheet_by" class="title">{{sheetInfo.by}}</div>
      <AntaresSheet id="sheet_body_block" :sheet-tree="sheetInfo.sheetTree" :events="sheetEvents"/>
      <div id="sheet_padding"></div>
    </div>
    
    <div id="sidebar" v-if="env == 'pc'">
      <div id="sidebar_fixed">
        <div class="sidebar_block" @click="tools.tipChord.enable = !tools.tipChord.enable" :class="getSidebarStateClass(tools.tipChord.enable)">
          <img src="/icons/bubble.svg" type="image/svg+xml" />
          <div class="sidebar_block_text">提示和弦</div>
        </div>
        <div class="sidebar_block" @click="tools.player.enable = !tools.player.enable" :class="getSidebarStateClass(tools.player.enable)">
          <img src="/icons/player.svg" type="image/svg+xml" />
          <div class="sidebar_block_text">播放器</div>
        </div>
        <div class="sidebar_block" @click="tools.sheetControl.enable = !tools.sheetControl.enable" :class="getSidebarStateClass(tools.sheetControl.enable)">
          <img src="/icons/layout.svg" type="image/svg+xml" />
          <div class="sidebar_block_text">滚动缩放</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script type="module">
import { getQueryVariable, getEnv } from "@/utils/common.js";
import { StringInstrument } from "@/utils/instrument.js";
import ChordManager from "@/utils/chordManager.js";
import { SheetNode, ENodeType, EPluginType, traverseNode } from "@/utils/sheetNode.js"
import { parseSheet } from "@/utils/sheetParser.js"
import { ELoadState } from "@/utils/common.js"

import Metronome from "@/components/metronome/index.vue"
import AntaresSheet from "@/components/antaresSheet/index.vue"
import Chord from "@/components/chord/index.vue"
import { get } from "@/utils/request.js"
import CapoSelector from "@/components/capoSelector.vue";

let g_Player = null

export default {
  name: "SheetViewer",
  components: {
    Metronome,
    AntaresSheet,
    Chord,
    CapoSelector
  },
  data() {
    return {
      globalCssVar: {
        "font-size": "var(--base-font-size)", 
        "--sheet-font-size": "var(--base-font-size)", 
        "--title-base-font-size": "30px", 
        "--title-scale": "1",
        "--chord-renderer-theme-color": "white", 
        "--chord-renderer-font-color": "black", 
        "--sheet-theme-color": "var(--theme-color)", 
        "--page-size": "100%", 
      },
      env: "pc",
      load: {
        params: {},
        state: ELoadState.Loading,
      },
      sheetInfo: {
        title: '加载中',
        singer: '',
        by: '',
        originalKey: '',
        sheetKey: '',
        chords: [],
        rhythms: [],
        originalSheetKey: '',
        sheetTree: new SheetNode(ENodeType.Root)
      },
      sheetEvents: {
        text: {
          click: (e, node) => {
            console.log("text", node)
          }
        },
        chord: {
          click: (e, node) => {
            this.playChord(ChordManager.getChord(node.chord))
          },
          mouseenter: (e, node) => {
            this.tools.tipChord.show = true
            this.tools.tipChord.chord = ChordManager.getChord(node.chord)
          },
          mouseleave: (e, node) => {
            this.tools.tipChord.show = false
          }
        },
        mark: {
          click: (e, node) => {
            console.log("mark", node)
          },
        }
      },
      tools: {
        tipChord: {
          enable: true,
          show: false,
          chord: {}
        },
        player: {
          enable: true,
          instrument: {
            type: "Ukulele",
            audioSource: "Oscillator",
            update: true,
            capo: 0,
          },
          metronome: {
            update: true,
          },
          loadState: ELoadState.Loading,
          loadProgress: 0.0,
        },
        sheetControl: {
          enable: true,
          scale: 1,
          autoScroll: {
            started: false,
            speed: 0.0,
            timer: null
          },
        }
      }
    }
  },
  computed: {
    loadStateString: function () {
      switch (this.load.state) {
        case ELoadState.Loading: return "加载中...";
        case ELoadState.Loaded: return "加载完成";
        case ELoadState.Failed: return "曲谱解析失败，请重试";
        case ELoadState.Empty: return this.load.params.sheetName ? `未找到指定文件 [${this.load.params.sheetName}]` : "未指定曲谱文件";
        default: return "未知状态";
      }
    },
    showLoadCover() {
      return this.load.state != ELoadState.Loaded;
    },
    toolsPlayerLoadingText: function () {
      switch (this.tools.player.loadState) {
        case ELoadState.Loading: return "加载中...";
        case ELoadState.Loaded: return "加载完成";
        case ELoadState.Failed: return "音源加载失败，请重试";
        default: return "未知错误：播放器遁入了虚空...";
      }
    },
    showPlayerLoadCover() {
      return this.tools.player.loadState != ELoadState.Loaded;
    },
    autoScrollSpeedText() {
      const speed = this.tools.sheetControl.autoScroll.speed
      return speed > 0.0 ? `x${parseFloat(speed).toFixed(1)}` : "停止"
    }
  },
  mounted() {
    // init global var
    this.loadPlayer()

    // setup
    this.changeScale()

    let sheetName = getQueryVariable("sheet")
    if (!sheetName) {
      this.load.state = ELoadState.Empty
      return
    }

    this.load.params.sheetName = sheetName
    get(`sheets/${sheetName}.sheet`).then((res) => {
      let rootNode = parseSheet(res)
      if (!rootNode) {
        this.load.state = ELoadState.Failed
        throw "曲谱解析失败！"
      }
      this.sheetInfo.title = rootNode.title
      this.sheetInfo.singer = rootNode.singer
      this.sheetInfo.by = rootNode.by
      this.sheetInfo.originalKey = rootNode.originalKey
      this.sheetInfo.sheetKey = rootNode.sheetKey
      this.sheetInfo.chords = rootNode.chords
      this.sheetInfo.rhythms = rootNode.rhythms
      this.sheetInfo.sheetTree = rootNode
      this.sheetInfo.originalSheetKey = rootNode.sheetKey
      this.load.state = ELoadState.Loaded
    }).catch((e) => {
      this.load.state = ELoadState.Failed
      console.error("曲谱获取失败：", e)
    })

    this.env = getEnv()

    let that = this
    // print event
    window.onbeforeprint = () => {
      that.env = "printing"
    }
    window.onafterprint = () => {
      that.env = getEnv()
    } 
  },
  methods: {
    changeScale() {
      let scale = parseFloat(this.tools.sheetControl.scale);
      let defaultFontSize, defaultTitleFontSize, unit
      if (this.env == "pc") {
        defaultFontSize = 20
        defaultTitleFontSize = 32
        unit = "px"
      } else if (this.env == "mobile"){
        defaultFontSize = 4
        defaultTitleFontSize = 8
        unit = "vw"
      } else {
        return;
      }
      document.documentElement.style.setProperty(
        "--base-font-size",
        `${defaultFontSize * scale}${unit}`
      );
      document.documentElement.style.setProperty(
        "--title-base-font-size",
        `${defaultTitleFontSize * scale}${unit}`
      );
    },
    changeAutoScrollSpeed() {
      if (!this.tools.sheetControl.autoScroll.started) {
        this.startAutoScroll()
      }
    },
    startAutoScroll() {
      let that = this
      let autoScroll = that.tools.sheetControl.autoScroll
      function scroll(amount) {
        document.documentElement.scrollTop += amount
        document.body.scrollTop += amount // 兼容老版chrome，好像小程序也需要用body
      }

      let lastTimeStamp = new Date().getTime()
      function scrollLoop() {
        let speed = autoScroll.speed
        if (speed == 0) {
          window.cancelAnimationFrame(autoScroll.timer)
          autoScroll.timer = null
          autoScroll.started = false
          return
        }
        const delay = 100 / speed
        let curTimeStamp = new Date().getTime()
        if (curTimeStamp - lastTimeStamp > delay) {
          let amount = (curTimeStamp - lastTimeStamp) / delay
          scroll(amount)
          lastTimeStamp = curTimeStamp
        }
        autoScroll.timer = window.requestAnimationFrame(scrollLoop)
      }
      autoScroll.started = true
      scrollLoop()
    },
    playChord(chord) {
      const capo = parseInt(this.tools.player.instrument.capo) ?? 0

      const bpm = this.$refs['metronome'].getBpm() ?? 120;
      let volume = 1.0;

      // play chord
      let duration = (1 / bpm) * 60 * 4;
      if (g_Player && g_Player.audioSource.loaded) {
        g_Player.setCapo(capo);
        g_Player.playChord(chord, volume, duration);
      }
    },
    shiftKey(offset) {
      let curKey = this.sheetInfo.sheetKey;
      let newKey = ChordManager.shiftKey(curKey, offset);
      this.sheetInfo.sheetKey = newKey

      traverseNode(this.sheetInfo.sheetTree, (node) => {
        if (node.type == ENodeType.Chord || node.type == ENodeType.ChordPure) {
          node.chord = ChordManager.shiftKey(node.chord, offset)
        } else if (node.type == ENodeType.Plugin && node.pluginType == EPluginType.Tab) {
          node.valid = (this.sheetInfo.originalSheetKey == this.sheetInfo.sheetKey);
        }
      })
    },
    getSidebarStateClass(state) {
      return state ? "" : "sidebar_disabled";
    },
    loadPlayer() {
      let that = this

      let resNum = 0
      if (this.tools.player.instrument.update) resNum++;
      if (this.tools.player.metronome.update) resNum++;
      let progressList = new Array(resNum).fill(0.0)
      let loadedResNum = 0

      function createCallbacks(i) {
        return {
          onLoadStart: function() {
            if (that.tools.player.loadState == ELoadState.Failed) return;
            that.tools.player.loadState = ELoadState.Loading
            progressList[i] = 0.0
          },
          onLoadProgress: function(progress) {
            progressList[i] = progress
            let allProgress = progressList.reduce((p, c) => p + c) / resNum
            // console.log("loading progress " + allProgress)
            that.tools.player.loadProgress = allProgress
          },
          onLoaded: function() {
            loadedResNum++;
            that.tools.player.loadProgress = 1.0
            if (loadedResNum == resNum) {
              // console.log("end loading")
              that.tools.player.loadState = ELoadState.Loaded
            }
          },
          onFailed: function() {
            that.tools.player.loadState = ELoadState.Failed
          }
        }
      }
      
      let curIndex = 0;
      
      if (this.tools.player.instrument.update) {
        let callbacks = createCallbacks(curIndex);
        g_Player = new StringInstrument(this.tools.player.instrument.type, this.tools.player.instrument.audioSource, callbacks)
        
        this.tools.player.instrument.update = false;
        curIndex++;
      }
      if (this.tools.player.metronome.update) {
        let callbacks = createCallbacks(curIndex);
        that.$refs['metronome'].load(callbacks)
        
        this.tools.player.metronome.update = false;
        curIndex++;
      }
     
    }
  },
  watch: {
    "tools.player.instrument.audioSource": function() {
      this.tools.player.instrument.update = true
      this.loadPlayer()
    }
  }
}
</script>

<style>
html, body {
  width: 100%;
  height: 100%;
  min-width: 300px;
}

::selection {
  background: var(--theme-color);
}

</style>

<style scoped lang="scss">
#viewer {
  width: 100%;
  height: 100%;
  margin: 0;
  position: relative;
  font-size: var(--base-font-size);

  display: flex;
}

#cover {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: wheat;
  color: var(--sheet-theme-color);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 50px;
  letter-spacing: 5px;
  z-index: 20;
  margin-right: auto;
}

#sidebar {
  --fold-width: 60px;
  --full-width: 160px;

  width: var(--fold-width);
  height: 100%;
  flex-shrink: 0;

  #sidebar_fixed {
    position: fixed;
    z-index: 11;
    top: 0;
    right: calc(var(--fold-width) - var(--full-width));
    height: 100%;
    width: var(--full-width);
    background-color: var(--sheet-theme-color);
    
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    overflow: hidden;
    color: white;
    opacity: 0.3;
    user-select: none;

    transition: right 0.2s ease-out, opacity 0.2s ease-out;
    img {
      width: 30px;
      height: 30px;
      margin: calc((var(--fold-width) - 30px) / 2);
    }

    .sidebar_block {
      width: 100%;
      height: var(--fold-width);
      display: flex;
      justify-content: center;
      align-items: center;
      
      * {
        flex-shrink: 0;
      }

      .sidebar_block_text {
        margin-right: auto;
        display: flex;
        justify-content: center;
      }
    }

    &:hover {
      right: 0px;
      opacity: 1;
    }
  }
}

#sheet {
  display: flex;
  flex-direction: column;
  padding-left: 20px;
  padding-right: 20px;
  box-sizing: border-box;

  * {
    flex-shrink: 0;
  }
}

.title {
  flex-shrink: 0;
  overflow: hidden;
  white-space: nowrap;
  word-break: break-all;
  text-overflow: ellipsis;
}

#song_title {
  margin: calc(var(--title-base-font-size) * 0.2) 0;
  height: calc(var(--title-base-font-size) * 2);
  line-height: calc(var(--title-base-font-size) * 2);
  font-size: calc(var(--title-base-font-size) * 1.5);
  color: black;
  width: 100%;
}

#song_singer {
  height: calc(var(--title-base-font-size) * 0.9);
  line-height: calc(var(--title-base-font-size) * 0.9);
  font-size: calc(var(--title-base-font-size) * 0.8);
  color: #aaaaaa;
}

#sheet_key_block {
  margin-top: 10px;
  line-height: var(--title-base-font-size);
  font-size: calc(var(--title-base-font-size) * 0.9);
  color: black;

  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

#sheet_original_key, #sheet_current_key {
  margin-right: 10px;
}

#sheet_current_key {
  display: flex;
  align-items: center;
}

#sheet_key_shift {
  width: 30px;
  margin: 0 10px;

  display: flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
}

#sheet_key_shift_up,
#sheet_key_shift_down {
  width: 100%;

  display: flex;
  justify-content: center;
  align-items: center;
}

#sheet_key_shift_up:hover,
#sheet_key_shift_down:hover {
  color: rgb(187, 73, 73);
}

#sheet_capo_block {
  display: flex;
  line-height: var(--title-base-font-size);
  font-size: calc(var(--title-base-font-size) * 0.9);
  color: #888;
}

#capo_selector {
  margin: 0 10px;
  background-color: transparent;
  font-size: calc(var(--title-base-font-size) * 0.8);
  border: none;
  outline: 2px solid grey;
}

#sheet_by {
  margin-top: 5px;
  height: calc(var(--title-base-font-size) * 0.8);
  line-height: calc(var(--title-base-font-size) * 0.8);
  font-size: calc(var(--title-base-font-size) * 0.7);
  color: rgb(156, 156, 156);
}

#sheet_body_block {
  width: 100%;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
}

#sheet_padding {
  height: 50vh;
}

.sheet_body {
  white-space: pre-wrap;
  margin: 0;
  width: 100%;
}

#tip_chord {
  position: fixed;
  right: 80px;
  top: 30px;
  height: 200px;
  width: 150px;
  transition: opacity 0.2s ease-out;
  pointer-events: none;

  z-index: 10;
}

.tools_block {
  position: fixed;
  padding: 10px;
  display: flex;
  justify-content: space-between;

  z-index: 10;
}

.tools_text {
  margin: 10px 0;
}

#tools_player {
  right: 90px;
  width: 160px;
  top: 40%;
  flex-direction: column;
  user-select: none;

  #load_cover {
    position: absolute;
    z-index: 11;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background-color: rgba(var(--theme-color-rgb), 0.8);

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 30px;
  }
}

#page_type_block {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

#paper_size_slider {
  display: none;
}
</style>

<style scoped>
.trans_fade_out-enter-from, 
.trans_fade_out-leave-to{
	opacity: 0;
}
.trans_fade_out-enter-active{
	transition: opacity 0.1s;
}
.trans_fade_out-leave-active{
	transition: opacity 1s;
}
</style>

<style scoped>
:deep(chord::after) {
  content: "";
  position: absolute;
  left: -10px;
  top: calc(-8px - var(--sheet-font-size));
  right: -10px;
  bottom: -2px;
  border: 2px solid transparent;
  transition: 0.3s ease-out;
  border-radius: 5px;
  z-index: 1;
  pointer-events: none;
}

:deep(chord-pure::after) {
  content: "";
  position: absolute;
  left: -10px;
  top: -2px;
  right: -10px;
  bottom: -2px;
  border: 2px solid transparent;
  transition: 0.3s ease-out;
  border-radius: 5px;
  z-index: 1;
  pointer-events: none;
}

:deep(chord:hover::after),
:deep(chord-pure:hover::after) {
  border: 2px solid var(--sheet-theme-color);
  box-shadow: 0 0 5px 2px black;
}

:deep(chord-ruby::before),
:deep(chord-pure::before) {
  content: "▶";
  position: absolute;
  font-size: 20px;
  color: black;
  transform: translate(-50%, -50%);
  top: 50%;
  left: 50%;
  opacity: 0;
}

:deep(chord:hover chord-ruby::before),
:deep(chord-pure:hover::before) {
  opacity: 0.8;
}
</style>

<style scoped lang="scss">
/* pc */
#viewer[env="pc"] {
  #sheet {
    width: 100%;
    margin: 0 200px;
  }

  .tools_text {
    width: 100%;
    height: 20px;
    text-align: center;
    line-height: 20px;
    font-size: 20px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  #tools_sheet_control {
    top: 25%;
    left: 10px;
    width: 160px;
    color: black;
  }

  #scale_block, #auto_scroll_block {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  #scale_slider, #auto_scroll_slider {
    flex-grow: 1;
    margin: 10px 0;
    height: 300px;
    -webkit-appearance: slider-vertical;
  }

  .sidebar_disabled {
    opacity: 0.3;
  }
}
</style>

<style scoped lang="scss">
/* mobile */
#viewer[env="mobile"] {
  #sheet {
    width: 90%;
  }

  .tools_text {
    width: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 4vw;
  }

  #tools_sheet_control {
    bottom: 0;
    height: 10vh;
    left: 0;
    width: 100%;
    background-color: #000000aa;
    flex-direction: column;
    color: white;
  }
  #tools_sheet_control input {
    flex-shrink: 0;
    width: 60%;
  }
  #scale_block, #auto_scroll_block {
    height: 100%;
    display: flex;
    overflow: hidden;
  }
  #scale_slider, #auto_scroll_slider {
    flex-grow: 1;
    margin: 10px 0;
  }
  #tools_player {
    display: none;
  }
  #scale_block {
    flex-direction: row;
  }

  #auto_scroll_block {
    flex-direction: row;
  }
}
</style>

<style scoped lang="scss">
/* printing */
#viewer[env="printing"] {
  #sheet {
    width: 100%;
  }

  #sidebar, #tools_sheet_control, #tools_player, #tip_chord, #sheet_padding {
    display: none;
  }
}
</style>