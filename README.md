# Meme Generator Airtable Block

![Airtable block Meme Generator](https://res.cloudinary.com/dlgztvq9v/image/upload/v1594045468/airtable-block-meme-generator.png)

The coolest and the easiest Meme Generator in town!

This block generates memes from a template of background Images.

It uses
- Remove.bg API to remove background from the Images
- Uses Cloudinary to do various Image and text manipulations

Features

- Removes background from the main image selected and then superimposes it on the background meme image.

- Reads (Optional) Meme text from the field, and then uses "Cloudinary" to overlay text on the image

- If not text is present, then an optional watermark can also be added over the images.

- Uses "View Picker" - So records to be processed can be selected based on a view or filters.

-  Uses Table Picker and Field picker to select all meme Generation Fields.

-   Text styling changes based on the length of the content

-  Option to update API Keys using GlobalConfig

## How to run this block

1. Create a new base using the
   [Meme GeneratorTemplate](https://airtable.com/invite/l?inviteId=invjdc7VUlMZssnBj&inviteToken=d9d8a86d2e7edc1090ed686da6aafcd4380763e5cdb6e5d675fd32d52b052eda).

2. Create a new block in your new base (see
   [Create a new block](https://airtable.com/developers/blocks/guides/hello-world-tutorial#create-a-new-block),
   selecting "Print records" as your template.

3. From the root of your new block, run `block run`.

## See the block running

![Generated Meme](https://res.cloudinary.com/dlgztvq9v/image/upload/v1594046323/meme1.png)

-----

![Meme Generator Screenshot](https://res.cloudinary.com/dlgztvq9v/image/upload/v1594046326/meme-generator-screenshot.png)
