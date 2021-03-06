// @flow

import {
  Matrix,
  Model,
  Node,
  Solver,
  initGRU,
  makeGRUGraph,
  forwardGRU,
  initLSTM,
  makeLSTMGraph,
  forwardLSTM,
  samplei,
  maxi
} from './recurrent'

import type { ModelType } from './recurrent/model'
import TrainingData from './training-data'

export type Params = {
  type: ModelType,
  maxGen: number,
  inputSize: number,
  letterSize: number,
  hiddenSizes: number[],
  outputSize: number
}

const forwardIndex = (
  { type, hiddenSizes }: Params,
  graph: Object,
  ix: number,
  prev: ?Object
) => (
  (type === 'gru' ? forwardGRU : forwardLSTM)(
    graph,
    hiddenSizes,
    ix,
    prev
  )
)

const costfun = (
  params: Params,
  graph: Object,
  data: TrainingData,
  text: string
): [number, number] => {
  let cost = 0
  let log2ppl = 0
  let prev

  const textLength = text.length
  for (let i = -1; i < textLength; i++) {
    // start and end tokens are zeros
    const ixSource = i !== -1 ?
      data.convertCharToIndex(text[i]) :
      0

    const ixTarget = i !== textLength - 1 ?
      data.convertCharToIndex(text[i + 1]) :
      0

    // Execute training step
    const {
      o: logprobs
    } = prev = forwardIndex(params, graph, ixSource, prev)

    // compute the softmax probabilities
    const probs = logprobs.softmax()

    // accumulate cost and (base 2) log probability
    const prob = probs.w[ixTarget]
    log2ppl -= Math.log2(prob)
    cost -= Math.log(prob)

    // write gradients into log probabilities
    logprobs.dw = probs.w
    logprobs.dw[ixTarget] -= 1
  }

  return [
    Math.pow(2, log2ppl / (textLength - 1)),
    cost
  ]
}

const predictSentence = (
  params: Params,
  graph: Object,
  data: TrainingData,
  temperature: number = 1
): string => {
  let s = ''
  let prev

  while (true) {
    const ix = s.length !== 0 ?
      data.convertCharToIndex(s[s.length - 1]) :
      0

    // Execute prediction step
    const {
      o: logprobs
    } = prev = forwardIndex(params, graph, ix, prev)

    if (temperature !== 1) {
      const nq = logprobs.w.length

      for (let q = 0; q < nq; q++) {
        logprobs.w[q] /= temperature
      }
    }

    const probs = logprobs.softmax()
    const prediction = samplei(probs.w)

    if (
      prediction === 0 ||
      s.length >= params.maxGen
    ) {
      break
    }

    s += data.convertIndexToChar(prediction)
  }

  return s
}

class Network {
  data: TrainingData
  solver: Solver
  model: Model
  params: Params
  graph: Object
  iterations: number

  constructor(
    input: string[],
    letterSize: number,
    hiddenSizes: number[],
    type: ModelType = 'gru'
  ) {
    const data = new TrainingData(input)
    const inputSize = data.charset.length + 1
    const outputSize = data.charset.length + 1

    this.data = data
    this.solver = new Solver()
    this.iterations = 0

    this.model = (type === 'gru' ? initGRU : initLSTM)
      (inputSize, letterSize, hiddenSizes, outputSize)

    this.params = {
      maxGen: data.maxLength,
      type,
      inputSize,
      letterSize,
      hiddenSizes,
      outputSize
    }

    this.graph = (type === 'gru' ? makeGRUGraph : makeLSTMGraph)
      (this.model, hiddenSizes)
  }

  train(stepSize: number = 0.002): [number, number] {
    const { params, graph, data, model, solver } = this

    // Sample random text entry
    const text = data.randomEntry()
    const result = costfun(params, graph, data, text)

    // Use graph to backprop (set .dw fields in matrices)
    while (graph.o.backward()) {}

    // Perform param update
    solver.step(model, stepSize)

    // Count up iterations
    this.iterations++

    // Return perplexity, cost
    return result
  }

  predict(temperature: number = 1): string {
    const result = predictSentence(
      this.params,
      this.graph,
      this.data,
      temperature
    )

    // Clean up graph, since prediction won't backprop
    this.graph.o.clear()

    return result
  }

  toJSON(): Object {
    const { data, model, solver, params, iterations } = this

    return {
      data: data.toJSON(),
      model: model.toJSON(),
      solver: solver.toJSON(),
      params,
      iterations
    }
  }

  static fromJSON({ data, model, solver, params, iterations }: Object): Network {
    const output = Object.create(Network.prototype)

    output.data = TrainingData.fromJSON(data)
    output.model = Model.fromJSON(model)
    output.solver = solver ? Solver.fromJSON(solver) : new Solver()
    output.params = params
    output.iterations = iterations

    output.graph = (params.type === 'gru' ? makeGRUGraph : makeLSTMGraph)
      (output.model, params.hiddenSizes)

    return output
  }
}

export default Network
