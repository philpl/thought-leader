// @flow

import path from 'path'
import dotenv from 'dotenv'
import { data, charset } from './utils/data'

dotenv.config()

export const twitterConfig = {
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN_KEY,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET
}

export const MODEL_PATH = path.join(process.cwd(), './data/net-state.json')

export const LETTER_SIZE = 5
export const HIDDEN_SIZES = [ 20, 20 ]
export const INPUT_SIZE = charset.length + 1
export const OUTPUT_SIZE = charset.length + 1
export const EPOCH_SIZE = data.length
export const MAX_GEN = 140