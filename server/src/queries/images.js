const db = require('./db').getDb();
const path = require('path');

/*
getForProject: (projectId) 
returns all images data
example:
[
  {
    id: 1,
    originalName: 'tesla.jpg',
    link: '/uploads/1/1.jpg',
    externalLink: null,
    localPath: null,
    labeled: 0,
    labelData: { labels: [Object], height: 627, width: 1200 },
    lastEdited: 1661526695010,
    projectsId: 1
  }
]
*/

const Images = {
  getForProject: projectId => {
    const images = db
      .prepare(
        `
select images.id, originalName, link, labeled, labelData, projectsId
from images
where images.projectsId = ?;
`
      )
      .all(projectId); // ? is replaced by projecctId

    return images.map(image => ({
      // all other keys will retain same data except labelData
      ...image,
      labelData: JSON.parse(image.labelData),
    }));
  },

  get: id => {
    const image = db
      .prepare(
        `
select *
from images
where images.id = ?;
`
      )
      .get(id);
    console.log(image);

    return { ...image, labelData: JSON.parse(image.labelData) };
  },

  addImageUrls: (projectId, urls) => {
    const getName = url =>
      path.basename(new URL(url, 'https://base.com').pathname);

    const stmt = db.prepare(`
insert into images(originalName, link, externalLink, labeled, labelData, projectsId)
values (?, 'stub', ?, 0, '{ }', ?);
`);

    for (const url of urls) {
      const name = getName(url);
      const { lastInsertRowid } = stmt.run(name, url, projectId);
      Images.updateLink(lastInsertRowid, { projectId, filename: name });
    }
  },

  addImageStub: (projectId, filename, localPath) => {
    const stmt = db.prepare(`
insert into images(originalName, localPath, link, labeled, labelData, projectsId)
values (?, ?, 'stub', 0, '{ }', ?);
`);

    const { lastInsertRowid } = stmt.run(filename, localPath, projectId);
    return lastInsertRowid;
  },

  updateLink: (imageId, { projectId, filename }) => {
    //extension name
    const ext = path.extname(filename);
    const link = `/uploads/${projectId}/${imageId}${ext}`;
    db.prepare(
      `
update images
   set link = ?
 where id = ?;
`
    ).run(link, imageId);
    return `${imageId}${ext}`;
  },

  allocateUnlabeledImage: (projectId, imageId) => {
    // after this period of time we consider the image to be up for labeling again
    const lastEditedTimeout = 5 * 60 * 1000;

    let result = null;
    db.transaction(() => {
      if (!imageId) {
        const unmarkedImage = db
          .prepare(
            `
select id
from images
where projectsId = ? and labeled = 0 and lastEdited < ?;
`
          )
          .get(projectId, new Date() - lastEditedTimeout);

        imageId = unmarkedImage && unmarkedImage.id;
      }

      if (!imageId) {
        result = null;
      } else {
        db.prepare(`update images set lastEdited = ? where id = ?;`).run(
          +new Date(),
          imageId
        );
        result = { imageId };
      }
    })();

    return result;
  },

  updateLabel: (imageId, labelData) => {
    db.prepare(
      `
update images
set labelData = ?, lastEdited = ?
where id = ?;
`
    ).run(JSON.stringify(labelData), +new Date(), imageId);
  },

  updateLabeled: (imageId, labeled) => {
    db.prepare(
      `
update images
set labeled = ?
where id = ?;
`
    ).run(labeled ? 1 : 0, imageId);
  },

  delete: imageId => {
    db.prepare(
      `
delete from images
where id = ?;
`
    ).run(imageId);
  },

  getForImport: (projectId, originalName) => {
    const image = db
      .prepare(
        `
select *
from images
where projectsId = ? and originalName = ?;
`
      )
      .get(projectId, originalName);

    if (!image) {
      throw new Error('No image with name ' + originalName);
    }

    return { ...image, labelData: JSON.parse(image.labelData) };
  },
};

console.log(Images.getForProject());
const temp = db.prepare('select * from images').all();
const temp2 = temp.map(image => ({
  ...image,
  labelData: JSON.parse(image.labelData),
}));
console.log(JSON.parse(temp[0].labelData));
console.log('temp2', temp2);

module.exports = Images;
