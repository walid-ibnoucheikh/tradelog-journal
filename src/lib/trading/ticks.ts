/** Round axis ticks (1, 2, 5 × a power of ten) that cover [min, max] with about `target` steps. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (min === max) {
    min -= 1
    max += 1
  }
  const rough = (max - min) / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const residual = rough / magnitude
  const step = (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10) * magnitude

  const ticks: number[] = []
  const first = Math.floor(min / step)
  const last = Math.ceil(max / step)
  for (let index = first; index <= last; index++) {
    ticks.push(Math.round(index * step * 1e6) / 1e6)
  }
  return ticks
}
