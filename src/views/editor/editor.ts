import { SheetNode } from "@/utils/sheetNode"
import { SheetEditCommand, SheetCommandPool } from "./editCommand"
import {
    SheetEditCommandInsertAfter,
    SheetEditCommandInsertBefore,
    SheetEditCommandRemove,
    SheetEditCommandUpdateContent,
    SheetEditCommandAddUnderline,
    SheetEditCommandExtendUnderline,
    SheetEditCommandMergeUnderline,
    SheetEditCommandRemoveUnderline,
    SheetEditCommandShrinkUnderline,
    SheetEditCommandSplitUnderline
} from "./editCommandImplement"
import { assert } from "@/utils/assert"
import { NodeUtils } from "@/utils/sheetEdit"

export default class SheetEditor {
    commandPool: SheetCommandPool = new SheetCommandPool()

    canUndo(): boolean { return this.commandPool.canUndo() }
    canRedo(): boolean { return this.commandPool.canRedo() }
    undo(): void { this.commandPool.undo() }
    redo(): void { this.commandPool.redo() }

    /** 在目标后方插入节点，可以是数组 */
    insertAfter(node: SheetNode, data) {
        let cmdInsert = new SheetEditCommandInsertAfter(node, data)
        this.commandPool.execute(cmdInsert)
    }

    /** 在目标前方插入节点，可以是数组 */
    insertBefore(node: SheetNode, data) {
        let cmdInsert = new SheetEditCommandInsertBefore(node, data)
        this.commandPool.execute(cmdInsert)
    }

    /** 更新节点的内容 */
    updateContent(node: SheetNode, content: string) {
        let cmd = new SheetEditCommandUpdateContent(node, content)
        this.commandPool.execute(cmd)
    }

    /** 给和弦添加一层下划线
     * 具体来说，输入是和弦节点，功能是在输入节点到下一个和弦节点之间，增加一条下划线
     */
    addUnderlineForChord(chordNode : SheetNode) {
        /** 算法分为两个步骤：
         * 首先找到下一个和弦节点
         * 然后是连接的方法，共有四种情况，三种处理方法：添加、扩展和合并
         */
        // constrain: underline must not have nearby underline sibling, as they can be merged to one unique underline
        assert(chordNode.isChord(), "添加下划线的必须是和弦节点")
        let chordType = chordNode.type;

        let nextChordNode = NodeUtils.findNextNodeByType(chordNode, chordType);
        assert(nextChordNode, "无法添加下划线：未找到下一个和弦")

        let cmd = null
        if (chordNode.parent == nextChordNode.parent) {
            // 同一层，那么将起始到结束之间的所有元素都放入一个下划线
            // console.log("s e");
            cmd = new SheetEditCommandAddUnderline(chordNode, nextChordNode)
        } else if (NodeUtils.parentsOf(chordNode).includes(nextChordNode.parent)) {
            // 起始在内层，结束在外层，则把起始元素的同级下划线（和结束同层）向后扩展到包围结束和弦
            // console.log("[s] e");
            let startUnderlineNode = NodeUtils.parentUntil(chordNode, nextChordNode.parent);

            cmd = new SheetEditCommandExtendUnderline(startUnderlineNode, nextChordNode)
        } else if (NodeUtils.parentsOf(nextChordNode).includes(chordNode.parent)) {
            // 起始在外层，结束在内层，则把结束元素的同级下划线（和起始同层）向前扩展到包围起始和弦
            // console.log("s [e]");
            let endUnderlineNode = NodeUtils.parentUntil(nextChordNode, chordNode.parent);
            cmd = new SheetEditCommandExtendUnderline(endUnderlineNode, chordNode)
        } else {
            // 起始结束都在内层（且不是同一个下划线），则把他们的同级下划线以及中间的元素合并到一个下划线
            // console.log("[s] [e]");
            let commonAncestorNode = NodeUtils.commonAncestor(chordNode, nextChordNode);
            let startUnderlineNode = NodeUtils.parentUntil(chordNode, commonAncestorNode);
            let endUnderlineNode = NodeUtils.parentUntil(nextChordNode, commonAncestorNode);

            cmd = new SheetEditCommandMergeUnderline(startUnderlineNode, endUnderlineNode)
        }

        assert(cmd, "未知错误，未找到合适的命令")
        this.commandPool.execute(cmd)
    }
    
    /** 删除和弦的一层下划线
     * 具体来说，输入是和弦节点，功能是在输入节点到下一个和弦节点之间，删除已有的一条下划线
     */
    removeUnderlineOnChord(chordNode : SheetNode) {
        assert(chordNode.isChord(), "要移除下划线的必须是和弦节点")
        assert(chordNode.parent.isUnderline(), "和弦不在下划线下，无需删除")

        let chordType = chordNode.type;
        let nextChordNode = NodeUtils.findNextNodeByType(chordNode, chordType);
        if (!nextChordNode) throw "未找到下一个和弦";

        let commonAncestorNode = NodeUtils.commonAncestor(chordNode, nextChordNode);
        assert(commonAncestorNode && commonAncestorNode.isUnderline(), "当前和弦和下一个和弦之间没有下划线连接，无需删除")

        // 起始节点是起始和弦，或包含起始和弦的下划线，终止节点同理
        // 且起始节点和终止节点一定是相邻的兄弟节点
        let startNode = NodeUtils.parentUntil(chordNode, commonAncestorNode);
        let endNode = NodeUtils.parentUntil(nextChordNode, commonAncestorNode);

        // constrain: underline must has chord at both begin and end
        // so if chord node is the first child, it must be beginning of underline
        let isBegin = chordNode.prevSibling() == null;
        let isEnd = nextChordNode.nextSibling() == null;

        let cmd = null
        if (isBegin && isEnd) {
            // 下划线只有这两个节点，则删除整个下划线，内容放到外面
            // console.log("[s e] -> s e");
            cmd = new SheetEditCommandRemoveUnderline(commonAncestorNode)
        } else if (!isBegin && isEnd) {
            // 起始节点前面还有元素，但结束节点后面没有，需要把起始节点之后的所有元素移出
            // console.log("[xxx s e] -> [xxx s] e");
            cmd = new SheetEditCommandShrinkUnderline(commonAncestorNode, startNode, true)
        } else if (isBegin && !isEnd) {
            // 起始节点前面没有，但结束节点后面有元素，需要把结束节点之前的所有元素移出
            // console.log("[s e xxx] -> s [e xxx]");
            cmd = new SheetEditCommandShrinkUnderline(commonAncestorNode, endNode, false)
        } else {
            // 前后都有元素，需要从中间断开
            // console.log("[xxx s e yyy] -> [xxx s] [e yyy]");
            cmd = new SheetEditCommandSplitUnderline(commonAncestorNode, startNode, endNode)
        }

        assert(cmd, "未知错误，未找到合适的命令")
        this.commandPool.execute(cmd)
    }
}