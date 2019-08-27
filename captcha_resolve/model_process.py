#!/usr/bin/env python
# coding: utf-8


import os
os.environ["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"   # see issue #152
os.environ["CUDA_VISIBLE_DEVICES"] = ""

import numpy as np
np.random.seed(1337)
import keras.backend as K
from keras.utils import np_utils
from keras.models import Sequential
from keras.layers import Dropout, Dense, Activation, Convolution2D, MaxPooling2D, Flatten, Dropout
from keras.optimizers import Adam
from keras.callbacks import LearningRateScheduler
from sklearn.model_selection import train_test_split
from PIL import Image


# In[2]:


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

def read_image(img_name):
    im = Image.open(img_name).convert("L")
    data = np.array(im)
    return data

images = []
labels = []
for fn in os.listdir('done'):
        if fn.endswith('.png'):
            fd = os.path.join('done', fn)
            if (len(fn.split('_')[1].split('.')[0]) == 4):
                images.append(read_image(fd))
                labels.append(text2vec(fn.split('_')[1].split('.')[0]))


# In[3]:


X = np.array(images)
y = np.array(labels)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=30)
X_train = X_train.reshape(-1, 43, 90, 1)/255.
X_test = X_test.reshape(-1, 43, 90, 1)/255.


# In[8]:


def scheduler(epoch):
    if epoch == 30:
        K.set_value(model.optimizer.lr, 1e-3)
        print('set learn rate: ', 1e-3)
    if epoch == 50:
        K.set_value(model.optimizer.lr, 1e-4)
        print('set learn rate: ', 1e-4)
    return K.get_value(model.optimizer.lr)

change_lr = LearningRateScheduler(scheduler)

def check_code_equal(y_true, y_pred):
    y_true_c = K.argmax(K.reshape(y_true, (-1, 4, 36)), axis = 2)
    y_pred_c =K.argmax( K.reshape(y_pred, (-1, 4, 36)), axis = 2)
    return K.equal(y_true_c, y_pred_c)

model = Sequential()
model.add(Convolution2D(filters=32, kernel_size=(3,3), padding='same', input_shape=(43, 90,1)))
model.add(Activation('relu'))
model.add(MaxPooling2D(pool_size=(2,2), strides=(2,2), padding='same'))
model.add(Convolution2D(filters=64, kernel_size=(3,3), padding='same'))
model.add(Activation('relu'))
model.add(MaxPooling2D(pool_size=(2,2), strides=(2,2), padding='same'))
model.add(Convolution2D(filters=128, kernel_size=(3,3), padding='same'))
model.add(Activation('relu'))
model.add(MaxPooling2D(pool_size=(2,2), strides=(2,2), padding='same'))
model.add(Dropout(0.25))
model.add(Convolution2D(filters=128, kernel_size=(3,3), padding='same'))
model.add(Activation('relu'))
model.add(MaxPooling2D(pool_size=(2,2), strides=(2,2), padding='same'))
model.add(Flatten())
model.add(Dense(1024))
model.add(Activation('relu'))
model.add(Dense(1024))
model.add(Activation('relu'))
model.add(Dropout(0.25))
model.add(Dense(144))
model.add(Activation('softmax'))
adam = Adam(lr = 1e-2)
model.compile(optimizer='adam',
              loss='categorical_crossentropy',
              metrics=[check_code_equal])
print('\ntraining ------------')
model.fit(X_train, y_train, epochs=30, batch_size=100, callbacks=[change_lr])
print('\ntesting ------------')
loss, accuracy = model.evaluate(X_test, y_test)
print('\ntest loss: ', loss)
print('\ntest accuracy: ', accuracy)

model.save('cnn_model.h5')
