import { a as e, n as t, r as n } from './index-ConJB3HE.js'
import { t as r } from './leaflet-src-C4vU8dvt.js'
var i = e(n(), 1)
function a(e, t) {
  let n = (0, i.useRef)(t)
  ;(0, i.useEffect)(
    function () {
      ;(t !== n.current &&
        e.attributionControl != null &&
        (n.current != null && e.attributionControl.removeAttribution(n.current),
        t != null && e.attributionControl.addAttribution(t)),
        (n.current = t))
    },
    [e, t],
  )
}
function o(e) {
  return Object.freeze({ __version: 1, map: e })
}
function s(e, t) {
  return Object.freeze({ ...e, ...t })
}
var c = (0, i.createContext)(null)
function l() {
  let e = (0, i.use)(c)
  if (e == null)
    throw Error(
      `No context provided: useLeafletContext() can only be used in a descendant of <MapContainer>`,
    )
  return e
}
var u = e(t(), 1)
function d(e) {
  function t(t, n) {
    let { instance: r, context: a } = e(t).current
    ;(0, i.useImperativeHandle)(n, () => r)
    let { children: o } = t
    return o == null ? null : i.createElement(c, { value: a }, o)
  }
  return (0, i.forwardRef)(t)
}
function f(e) {
  function t(t, n) {
    let [r, a] = (0, i.useState)(!1),
      { instance: o } = e(t, a).current
    ;((0, i.useImperativeHandle)(n, () => o),
      (0, i.useEffect)(
        function () {
          r && o.update()
        },
        [o, r, t.children],
      ))
    let s = o._contentNode
    return s ? (0, u.createPortal)(t.children, s) : null
  }
  return (0, i.forwardRef)(t)
}
function p(e) {
  function t(t, n) {
    let { instance: r } = e(t).current
    return ((0, i.useImperativeHandle)(n, () => r), null)
  }
  return (0, i.forwardRef)(t)
}
function m(e, t) {
  let n = (0, i.useRef)(void 0)
  ;(0, i.useEffect)(
    function () {
      return (
        t != null && e.instance.on(t),
        (n.current = t),
        function () {
          ;(n.current != null && e.instance.off(n.current), (n.current = null))
        }
      )
    },
    [e, t],
  )
}
function h(e, t) {
  let n = e.pane ?? t.pane
  return n ? { ...e, pane: n } : e
}
function g(e, t) {
  return function (n, r) {
    let i = l(),
      o = e(h(n, i), i)
    return (
      a(i.map, n.attribution),
      m(o.current, n.eventHandlers),
      t(o.current, i, n, r),
      o
    )
  }
}
function _(e, t, n) {
  return Object.freeze({ instance: e, context: t, container: n })
}
function v(e, t) {
  return t == null
    ? function (t, n) {
        let r = (0, i.useRef)(void 0)
        return ((r.current ||= e(t, n)), r)
      }
    : function (n, r) {
        let a = (0, i.useRef)(void 0)
        a.current ||= e(n, r)
        let o = (0, i.useRef)(n),
          { instance: s } = a.current
        return (
          (0, i.useEffect)(
            function () {
              o.current !== n && (t(s, n, o.current), (o.current = n))
            },
            [s, n, t],
          ),
          a
        )
      }
}
function y(e, t) {
  ;(0, i.useEffect)(
    function () {
      return (
        (t.layerContainer ?? t.map).addLayer(e.instance),
        function () {
          ;(t.layerContainer?.removeLayer(e.instance),
            t.map.removeLayer(e.instance))
        }
      )
    },
    [t, e],
  )
}
function b(e) {
  return function (t) {
    let n = l(),
      r = e(h(t, n), n)
    return (
      a(n.map, t.attribution),
      m(r.current, t.eventHandlers),
      y(r.current, n),
      r
    )
  }
}
function x(e, t) {
  return d(b(v(e, t)))
}
function S(e, t) {
  return f(g(v(e), t))
}
function C(e, t) {
  return p(b(v(e, t)))
}
function w(e, t, n) {
  let { opacity: r, zIndex: i } = t
  ;(r != null && r !== n.opacity && e.setOpacity(r),
    i != null && i !== n.zIndex && e.setZIndex(i))
}
var T = r()
function E(
  {
    bounds: e,
    boundsOptions: t,
    center: n,
    children: r,
    className: a,
    id: s,
    placeholder: l,
    style: u,
    whenReady: d,
    zoom: f,
    ...p
  },
  m,
) {
  let [h] = (0, i.useState)({ className: a, id: s, style: u }),
    [g, _] = (0, i.useState)(null),
    v = (0, i.useRef)(void 0)
  ;(0, i.useImperativeHandle)(m, () => g?.map ?? null, [g])
  let y = (0, i.useCallback)((r) => {
    if (r !== null && !v.current) {
      let i = new T.Map(r, p)
      ;((v.current = i),
        n != null && f != null
          ? i.setView(n, f)
          : e != null && i.fitBounds(e, t),
        d != null && i.whenReady(d),
        _(o(i)))
    }
  }, [])
  ;(0, i.useEffect)(
    () => () => {
      g?.map.remove()
    },
    [g],
  )
  let b = g ? i.createElement(c, { value: g }, r) : (l ?? null)
  return i.createElement(`div`, { ...h, ref: y }, b)
}
var D = (0, i.forwardRef)(E),
  O = x(
    function ({ position: e, ...t }, n) {
      let r = new T.Marker(e, t)
      return _(r, s(n, { overlayContainer: r }))
    },
    function (e, t, n) {
      ;(t.position !== n.position && e.setLatLng(t.position),
        t.icon != null && t.icon !== n.icon && e.setIcon(t.icon),
        t.zIndexOffset != null &&
          t.zIndexOffset !== n.zIndexOffset &&
          e.setZIndexOffset(t.zIndexOffset),
        t.opacity != null && t.opacity !== n.opacity && e.setOpacity(t.opacity),
        e.dragging != null &&
          t.draggable !== n.draggable &&
          (t.draggable === !0 ? e.dragging.enable() : e.dragging.disable()))
    },
  ),
  k = S(
    function (e, t) {
      return _(new T.Popup(e, t.overlayContainer), t)
    },
    function (e, t, { position: n }, r) {
      ;(0, i.useEffect)(
        function () {
          let { instance: i } = e
          function a(e) {
            e.popup === i && (i.update(), r(!0))
          }
          function o(e) {
            e.popup === i && r(!1)
          }
          return (
            t.map.on({ popupopen: a, popupclose: o }),
            t.overlayContainer == null
              ? (n != null && i.setLatLng(n), i.openOn(t.map))
              : t.overlayContainer.bindPopup(i),
            function () {
              ;(t.map.off({ popupopen: a, popupclose: o }),
                t.overlayContainer?.unbindPopup(),
                t.map.removeLayer(i))
            }
          )
        },
        [e, t, r, n],
      )
    },
  ),
  A = C(
    function ({ url: e, ...t }, n) {
      return _(new T.TileLayer(e, h(t, n)), n)
    },
    function (e, t, n) {
      w(e, t, n)
      let { url: r } = t
      r != null && r !== n.url && e.setUrl(r)
    },
  )
export { D as MapContainer, O as Marker, k as Popup, A as TileLayer }
