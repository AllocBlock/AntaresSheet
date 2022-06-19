import $ from "jquery"

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export const ELoadState = {
  Loading: 0,
  Loaded: 1,
  Failed: 2,
  Empty: 3,
}

export function getPos(element) {
  // *raw dom implementation
  // var rect = element.getBoundingClientRect();
  // return {
  //   top: (rect.top + (document.documentElement.scrollTop || document.body.scrollTop)) - window.pageYOffset,
  //   left: rect.left - window.pageXOffset,
  // };

  // *jq implementation
  return $(element).offset()
}

export function setPos(element, left, top) {
  // update pos by vue is too slow, so use jquery to update directly
  $(element).css({ left, top })
}

export function getRelativePos(element, pageX, pageY) {
  let $e = $(element)
	let left = pageX - $e.offset().left;
	let top = pageY - $e.offset().top;

  return {
    left, top
  }
}

// 可以在元素时也获取到正确值
export function getInnerSize(element) {
  let $e = $(element)
	let w = $e.innerWidth()
	let h = $e.innerHeight()

  return {
    w, h
  }
}

export function getQueryVariable(key) {
  var query = window.location.search.substring(1)
  var vars = query.split("&")
  for (var pairStr of vars) {
    var pair = pairStr.split("=", 2)
    if (pair[0] == key)
      return decodeURI(pair[1])
  }
  return null
}

let g_Env = "pc"
function autoSetEnv() {
  // 检查环境
  if (document.body.clientWidth / document.body.clientHeight < 0.8) {
    // 竖屏
    g_Env = "mobile";
  } else {
    g_Env = "pc";
  }
}
autoSetEnv()

export function getEnv() {
  return g_Env
}

export function setEnv(env) {
  return g_Env = env
}

export function getCursorClientPos(e) {
  if (e.originalEvent) e = originalEvent

  if (e.clientX != undefined) {
    return [e.clientX, e.clientY];
  } else {
    return [
      e.changedTouches[0].clientX,
      e.changedTouches[0].clientY,
    ];
  }
}