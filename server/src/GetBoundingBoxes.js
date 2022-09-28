const tfnode = require('@tensorflow/tfjs-node');
const cocoSsd = require('@tensorflow-models/coco-ssd');
const fs = require('fs');
const sizeOf = require('buffer-image-size');
const { resolve } = require('path');
const { model, imag } = require('@tensorflow/tfjs-node');
var cocoModel = undefined;
async function loadModel() {
  console.log('Started fetching the model');
  const model = await cocoSsd.load();
  return model;
}

const readImage = path => {
  const imageBuffer = fs.readFileSync(path);
  var dimensions = sizeOf(imageBuffer);
  // console.log("image dimenstions", dimensions.width, dimensions.height);
  const tfimage = tfnode.node.decodeImage(imageBuffer);
  console.log(tfimage.data);
  return { image: tfimage, width: dimensions.width, height: dimensions.height };
};

function is_model_loaded() {
  return new Promise((resolve, reject) => {
    if (cocoModel !== undefined) resolve(true);
    loadModel().then(model => {
      cocoModel = model;
      resolve(true);
    });
  });
}

function detect_objs(image) {
  return new Promise((resolve, reject) => {
    cocoModel.detect(image).then(preds => resolve(preds));
  });
}

function convert_predictions(predictions, image) {
  const required_predictions = { predictions: [] };

  predictions.forEach(box => {
    bbox = box.bbox;
    xmin = bbox[0] / image.width;
    ymin = bbox[1] / image.height;
    xmax = xmin + bbox[2] / image.width;
    ymax = ymin + bbox[3] / image.height;
    required_predictions.predictions.push({
      det_boxes: [ymin, xmin, ymax, xmax],
      det_class: box.class,
      det_score: box.score,
    });
  });
  console.log('required', required_predictions);
  return required_predictions;
}

async function predict(path) {
  const image = readImage(path);
  // console.log(image.width, image.height);
  return new Promise((resolve, reject) => {
    is_model_loaded().then(() => {
      console.log('image', image.image);
      detect_objs(image.image)
        .then(predictions => {
          return new Promise((resolve, reject) => {
            resolve(convert_predictions(predictions, image));
          });
        })
        .then(predictions => resolve(predictions));
    });
  });
  // }
}
// predict("/home/kmit-nvidia/new_gen/ShivaReddy/image_labeling_tool/label-tool/server/uploads/1/1.jpg").then(temp => console.log("temp", temp));

module.exports = { predict };

/*
{
    "predictions": [
      {
         "det_boxes": [<ymin>, <xmin>, <ymax>, <xmax>],
         "det_class": <str>,
         "det_score": <0 ~ 1 floating number
      },
      ...,
      ...
      ]
  }
  
*/

/*
async function send_predictions(path)
    {
      pred = await cocoSsd.predict(path)
      console.log("pred before", pred);
      return pred;
    }
    send_predictions("/home/kmit-nvidia/new_gen/ShivaReddy/image_labeling_tool/label-tool/server/uploads/1/1.jpg").then(pred => {
      console.log("pred", pred);
      res.end(JSON.stringify(temp_output))
    });*/
