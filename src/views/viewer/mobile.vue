<template>
  <div id="viewer" :style="globalCssVar">
    <SheetViewerLoadCover :state="this.load.state" />

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
          v-model="tools.sheetControl.autoScrollSpeed"
          @input="onAutoScrollSpeedChange()"
        />
        <div id="auto_scroll_text" class="tools_text">{{autoScrollSpeedText}}</div>
      </div>
    </div>

    <!-- <Chord id="tip_chord" v-if="tools.tipChord.enable" :style="`opacity: ${tools.tipChord.show ? 1 : 0}`" :chord="tools.tipChord.chord" /> -->

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
          <div class="title">变调夹 {{ capoName }}</div>
        </div>
      </div>
      <div id="sheet_by" class="title">{{sheetInfo.by}}</div>
      <AntaresSheet id="sheet_body_block" :sheet-tree="sheetInfo.sheetTree" :events="sheetEvents"/>
      <div id="sheet_padding"></div>
    </div>
    
  </div>
</template>

<script type="module">
import { getQueryVariable } from "@/utils/common.js";
import { StringInstrument } from "@/utils/instrument.js";
import ChordManager from "@/utils/chordManager.js";
import { ENodeType, EPluginType, traverseNode } from "@/utils/sheetNode.js"
import { parseSheet } from "@/utils/sheetParser.js"
import { ELoadState } from "@/utils/common.js"
import AutoScroll from "./autoScroll.js"
import SheetInfo from "./sheetInfo.ts"

import AntaresSheet from "@/components/antaresSheet/index.vue"
import Chord from "@/components/chord/index.vue"
import { get } from "@/utils/request.js"
import SheetViewerLoadCover from "./loadCover.vue";

let gPlayer = null

export default {
  name: "SheetViewerMobile",
  components: {
    AntaresSheet,
    Chord,
    SheetViewerLoadCover
  },
  data() {
    return {
      globalCssVar: {
        "--sheet-font-size": "var(--base-font-size)", 
        "--title-base-font-size": "30px", 
        "--title-scale": "1",
        "--chord-renderer-theme-color": "white", 
        "--chord-renderer-font-color": "black", 
        "--sheet-theme-color": "var(--theme-color)", 
        "--page-size": "100%", 
      },
      load: {
        state: ELoadState.Loading,
      },
      sheetInfo: new SheetInfo(),
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
        },
        mark: {
          click: (e, node) => {
            console.log("mark", node)
          },
        }
      },
      tools: {
        player: {
          enable: true,
          instrument: {
            type: "Ukulele",
            audioSource: "Oscillator",
            update: true,
            capo: 0,
          },
          loadState: ELoadState.Loading,
        },
        sheetControl: {
          enable: true,
          scale: 1,
          autoScrollSpeed: 0.0
        }
      }
    }
  },
  computed: {
    showPlayerLoadCover() {
      return this.tools.player.loadState != ELoadState.Loaded;
    },
    autoScrollSpeedText() {
      let speed = parseFloat(this.tools.sheetControl.autoScrollSpeed)
      return speed > 0.0 ? `x${parseFloat(speed).toFixed(1)}` : "停止"
    },
    capoName() {
      let capo = this.tools.player.instrument.capo
      if (capo == 0) return "无"
      else return `${capo}品`
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

    get(`sheets/${sheetName}.atrs`).then((res) => {
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
  },
  methods: {
    changeScale() {
      let scale = parseFloat(this.tools.sheetControl.scale);
      let defaultFontSize = 4
      let defaultTitleFontSize = 8
      let unit = "vw"
     
      document.documentElement.style.setProperty(
        "--base-font-size",
        `${defaultFontSize * scale}${unit}`
      );
      document.documentElement.style.setProperty(
        "--title-base-font-size",
        `${defaultTitleFontSize * scale}${unit}`
      );
    },
    onAutoScrollSpeedChange() {
      let speed = parseFloat(this.tools.sheetControl.autoScrollSpeed)
      AutoScroll.setSpeed(speed)
    },
    playChord(chord) {
      const capo = parseInt(this.tools.player.instrument.capo) ?? 0

      const bpm = 120;
      let volume = 1.0;

      // play chord
      let duration = (1 / bpm) * 60 * 4;
      if (gPlayer && gPlayer.audioSource.loaded) {
        gPlayer.setCapo(capo);
        gPlayer.playChord(chord, volume, duration);
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
    loadPlayer() {
      let that = this
      
      if (this.tools.player.instrument.update) {
        let callbacks = {
          onLoadStart: function() {
            that.tools.player.loadState = ELoadState.Loading
          },
          onLoaded: function() {
            that.tools.player.loadState = ELoadState.Loaded
          },
          onFailed: function() {
            that.tools.player.loadState = ELoadState.Failed
          }
        }
        
        gPlayer = new StringInstrument(this.tools.player.instrument.type, this.tools.player.instrument.audioSource, callbacks)
        
        this.tools.player.instrument.update = false;
      }
    }
  },
}
</script>

<style src="./common.scss" scoped></style>

<style scoped lang="scss">
#viewer {
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
  #scale_block {
    flex-direction: row;
  }

  #auto_scroll_block {
    flex-direction: row;
  }
}
</style>