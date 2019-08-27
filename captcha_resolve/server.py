#!/usr/bin/env python
# coding: utf-8


from sanic import Sanic
from sanic.response import json
import base64
import os
from io import BytesIO
import numpy as np
np.random.seed(1337)
import keras.backend as K
from keras.utils import np_utils
from keras.models import Sequential
from keras.layers import Dropout, Dense, Activation, Convolution2D, MaxPooling2D, Flatten, Dropout
from keras.optimizers import Adam
from keras.callbacks import LearningRateScheduler
from PIL import Image
from keras.models import load_model

def check_code_equal(y_true, y_pred):
    y_true_c = K.argmax(K.reshape(y_true, (-1, 4, 36)), axis = 2)
    y_pred_c =K.argmax( K.reshape(y_pred, (-1, 4, 36)), axis = 2)
    return K.equal(y_true_c, y_pred_c)

import keras.metrics
keras.metrics.check_code_equal = check_code_equal

model = load_model('cnn_model_82.h5')

captcha_chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
CHAR_SET_LEN = len(captcha_chars)
CAPTCHA_SIZE = 4
char_idx_mappings = {}
idx_char_mappings = {}

for idx, c in enumerate(list(captcha_chars)):
    char_idx_mappings[c] = idx
    idx_char_mappings[idx] = c

def text2vec(text):
    vector = np.zeros(CAPTCHA_SIZE*CHAR_SET_LEN)
    for i, c in enumerate(text):
        idx = i * CHAR_SET_LEN + char_idx_mappings[c]
        vector[idx] = 1
    return vector



app = Sanic()

@app.route("/")
async def test(request):
    return json({"hello": "world"})

@app.route("/captcha", methods=["POST",])
def post_json(request):
    print("img base64:", request.json['img'])
    img = Image.open(BytesIO(base64.b64decode(request.json['img']))).convert("L")
    data = np.array(img)
    data = data.reshape(-1, 43, 90, 1)/255.
    preds = model.predict(data)
    chars = preds[0].reshape(4, 36).argmax(axis = 1)
    code = idx_char_mappings[chars[0]]+ idx_char_mappings[chars[1]] + idx_char_mappings[chars[2]] + idx_char_mappings[chars[3]]
    print(code)
    return json({ "code": code})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8020)
