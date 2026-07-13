// Client-side marker clustering. When the map is zoomed out, nearby plant
// markers overlap into an unreadable pile; grouping them into a single "forest"
// bubble (with a count) keeps the map legible and gives the user something to
// click to zoom into. We cluster in *screen space* — points closer than a pixel
// radius at the current zoom merge — so clusters break apart naturally as you
// zoom in, without any per-zoom tuning.
//
// This mirrors what a library like supercluster does, but the input is only the
// current viewport's trees (tens, occasionally low hundreds), so a simple greedy
// O(n^2) pass recomputed on move-end is plenty and avoids a new dependency.

const TILE_SIZE = 512 // MapLibre's tile size; sets the world pixel dimensions.

// Web Mercator projection to normalized [0,1] world coordinates (zoom-agnostic).
function project01(lng, lat) {
  const x = (lng + 180) / 360
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const s = Math.sin((clampedLat * Math.PI) / 180)
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
  return [x, y]
}

// Group trees whose markers fall within `radiusPx` of each other at `zoom`.
// Returns an array of clusters, each: { id, lng, lat, count, trees, bounds }.
// A cluster with count === 1 is a lone marker; count > 1 is a forest bubble.
// `bounds` is the lng/lat extent of the members, used to fit the map when the
// bubble is clicked so every plant inside comes into view.
export function clusterTrees(trees, zoom, radiusPx = 56) {
  if (!trees?.length) return []
  const worldSize = TILE_SIZE * Math.pow(2, zoom)
  const points = trees.map((tree) => {
    const [x, y] = project01(tree.lng, tree.lat)
    return { tree, px: x * worldSize, py: y * worldSize }
  })

  const used = new Array(points.length).fill(false)
  const r2 = radiusPx * radiusPx
  const clusters = []

  for (let i = 0; i < points.length; i += 1) {
    if (used[i]) continue
    used[i] = true
    const members = [points[i]]

    // Gather every still-unclustered point within the radius of this seed.
    for (let j = i + 1; j < points.length; j += 1) {
      if (used[j]) continue
      const dx = points[i].px - points[j].px
      const dy = points[i].py - points[j].py
      if (dx * dx + dy * dy <= r2) {
        used[j] = true
        members.push(points[j])
      }
    }

    const memberTrees = members.map((m) => m.tree)
    let sumLng = 0
    let sumLat = 0
    let minLng = Infinity
    let minLat = Infinity
    let maxLng = -Infinity
    let maxLat = -Infinity
    for (const { tree } of members) {
      sumLng += tree.lng
      sumLat += tree.lat
      if (tree.lng < minLng) minLng = tree.lng
      if (tree.lat < minLat) minLat = tree.lat
      if (tree.lng > maxLng) maxLng = tree.lng
      if (tree.lat > maxLat) maxLat = tree.lat
    }

    clusters.push({
      // Stable key across recomputes: seeded from the first member's id so the
      // same visual bubble keeps its identity (and its enter animation) frame to
      // frame as long as it anchors the same plant.
      id: `cluster-${memberTrees[0].id}`,
      lng: sumLng / members.length,
      lat: sumLat / members.length,
      count: members.length,
      trees: memberTrees,
      bounds: { minLng, minLat, maxLng, maxLat },
    })
  }

  return clusters
}
