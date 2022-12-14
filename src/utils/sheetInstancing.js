import { SheetNode, ENodeType, EPluginType, createUnknownNode } from "@/utils/sheetNode.js"

export function createInstance(sheetTreeRoot) {
  for(let childNode of node.children)
    traverseNode(childNode, callback)
  callback(node)
}