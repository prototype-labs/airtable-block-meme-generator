import {
  initializeBlock,
  useBase,
  useRecords,
  useGlobalConfig,
  useSettingsButton,
  Loader,
  Button,
  Box,
  FormField,
  InputSynced,
  TablePickerSynced,
  FieldPickerSynced,
  ViewPickerSynced,
} from "@airtable/blocks/ui";
import { viewport } from "@airtable/blocks";

import { FieldType } from "@airtable/blocks/models";
import React, { Fragment, useState } from "react";
const url = require("url");
var cloudinary = require("cloudinary/lib/cloudinary").v2;
var removeBgApiKey, cloudinaryUrl, memeField, memeFieldId;

viewport.addMinSize({
  height: 260,
  width: 400,
});

const MAX_RECORDS_PER_UPDATE = 50;

function MemeGeneratorBlock() {
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  useSettingsButton(() => {
    if (!isSettingsVisible) {
      viewport.enterFullscreenIfPossible();
    }
    setIsSettingsVisible(!isSettingsVisible);
  });

  const base = useBase();
  const globalConfig = useGlobalConfig();

  const tableId = globalConfig.get("selectedTableId");
  const table = base.getTableByIdIfExists(tableId);

  const viewId = globalConfig.get("selectedViewId");
  const view = table ? table.getViewByIdIfExists(viewId) : null;

  const imageFieldId = globalConfig.get("imageFieldId");
  const imageField = table ? table.getFieldByIdIfExists(imageFieldId) : null;

  const backgroundImageFieldId = globalConfig.get("backgroundImageFieldId");
  const backgroundImageField = table
    ? table.getFieldByIdIfExists(backgroundImageFieldId)
    : null;

  memeFieldId = globalConfig.get("memeFieldId");
  memeField = table ? table.getFieldByIdIfExists(memeFieldId) : null;

  const memeTextFieldId = globalConfig.get("memeTextFieldId");
  const memeTextField = table
    ? table.getFieldByIdIfExists(memeTextFieldId)
    : null;

  removeBgApiKey = globalConfig.get("removeBgApiKey");
  cloudinaryUrl = globalConfig.get("cloudinaryUrl");

  if (cloudinaryUrl != null) {
    let uri = url.parse(cloudinaryUrl, true);

    const cloudinaryApiKey = uri.auth && uri.auth.split(":")[0];
    const cloudinaryApiSecret = uri.auth && uri.auth.split(":")[1];
    cloudinary.config({
      cloud_name: uri.host,
      api_key: cloudinaryApiKey,
      api_secret: cloudinaryApiSecret,
    });
  }
  const records = useRecords(view, {
    fields: [imageField, backgroundImageField, memeTextField],
  });

  const [isUpdateInProgress, setIsUpdateInProgress] = useState(false);

  const permissionCheck = imageField
    ? table.checkPermissionsForUpdateRecord(undefined, {
        [imageField.name]: undefined,
      })
    : { hasPermission: false, reasonDisplayString: "Table does not exist" };

  async function onButtonClick() {
    setIsUpdateInProgress(true);
    const recordUpdates = await getImageUpdatesAsync(
      table,
      imageField,
      backgroundImageField,
      memeTextField,
      records,
      removeBgApiKey
    );
    await updateRecordsInBatchesAsync(table, recordUpdates);
    setIsUpdateInProgress(false);
  }

  return (
    <Box padding={3} borderBottom="thick">
      <FormField label="Table">
        <TablePickerSynced globalConfigKey="selectedTableId" />
      </FormField>
      <FormField label="View">
        <ViewPickerSynced table={table} globalConfigKey="selectedViewId" />
      </FormField>
      <FormField label="Foreground Image Field">
        <FieldPickerSynced
          table={table}
          globalConfigKey="imageFieldId"
          placeholder="Pick source image field"
          allowedTypes={[FieldType.MULTIPLE_ATTACHMENTS]}
        />
      </FormField>

      <FormField label="Background Image Field">
        <FieldPickerSynced
          table={table}
          globalConfigKey="backgroundImageFieldId"
          placeholder="Pick the field for background image"
          allowedTypes={[FieldType.MULTIPLE_ATTACHMENTS]}
        />
      </FormField>

      <FormField label="Text field">
        <FieldPickerSynced
          table={table}
          globalConfigKey="memeTextFieldId"
          placeholder="Pick the field for meme text"
          allowedTypes={[FieldType.SINGLE_LINE_TEXT]}
        />
      </FormField>

      <FormField label="Meme Output Field">
        <FieldPickerSynced
          table={table}
          globalConfigKey="memeFieldId"
          placeholder="Pick the field for Meme"
          allowedTypes={[FieldType.MULTIPLE_ATTACHMENTS]}
        />
      </FormField>

      <FormField label="Remove BG API Key">
        <InputSynced
          globalConfigKey="removeBgApiKey"
          placeholder="API KEY"
          width="630px"
        />
      </FormField>
      <FormField label="Cloudinary URL">
        <InputSynced
          globalConfigKey="cloudinaryUrl"
          placeholder="Cloudinary Url"
          width="630px"
        />
      </FormField>
      {isUpdateInProgress ? (
        <Loader />
      ) : (
        <Fragment>
          <Button
            variant="primary"
            onClick={onButtonClick}
            disabled={!permissionCheck.hasPermission}
            marginBottom={3}
            marginTop={3}
            size="large"
            width="300px"
          >
            Generate Meme
          </Button>
          {!permissionCheck.hasPermission &&
            permissionCheck.reasonDisplayString}
        </Fragment>
      )}
    </Box>
  );
}

async function getImageUpdatesAsync(
  table,
  imageField,
  backgroundImageField,
  memeTextField,
  records,
  removeBgApiKey
) {
  const recordUpdates = [];
  for (const record of records) {
    const imageAttachmentCellValue = record.getCellValue(imageField);
    const backgroundImageAttachmentCellValue = record.getCellValue(
      backgroundImageField
    );
    const memeText = record.getCellValue(memeTextField);

    const imageUrl = imageAttachmentCellValue
      ? imageAttachmentCellValue[0]["url"]
      : null;
    const backgroundImageUrl = backgroundImageAttachmentCellValue
      ? backgroundImageAttachmentCellValue[0]["url"]
      : null;

    if (imageAttachmentCellValue) {
      const requestUrl = "https://api.remove.bg/v1.0/removebg";
      var headers = {
        "X-Api-Key": removeBgApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      var data = {
        image_url: imageUrl,
        size: "auto",
        format: "png",
      };

      if (backgroundImageUrl) {
        data.bg_image_url = backgroundImageUrl;
      }

      const response = await fetch(requestUrl, {
        method: "POST",
        headers: headers,
        cors: true,
        body: JSON.stringify(data),
      });

      const updatedImage = await response.json();
      console.log({ updatedImage });
      const editedImage =
        "data:image/png;base64," + updatedImage.data.result_b64;
      console.log({ editedImage });
      const encodedMemeText = encodeURI(memeText);

      var cloudinaryOptions;
      if (memeText) {
        const memeFontSize = memeText.length > 15 ? 40 : 60;
        const memeY = memeText.length > 15 ? 30 : 25;
        cloudinaryOptions = {
          transformation: [
            { crop: "pad" },
            {
              overlay: "black_bar",
              gravity: "south",
              width: "1.0",
              height: "0.25",
              flags: "relative",
              opacity: 60,
            },
            {
              overlay: {
                font_family: "Bangers",
                font_size: memeFontSize,
                text: encodedMemeText,
              },
              gravity: "south",
              y: memeY,
              color: "#eee",
            },
          ],
        };
      } else {
        cloudinaryOptions = {
          transformation: [
            { crop: "pad" },
            {
              overlay: "black_bar",
              gravity: "south",
              width: "1.0",
              height: "0.1",
              flags: "relative",
              opacity: 60,
            },
            {
              overlay: {
                font_family: "Arial",
                font_size: 20,
                text: encodeURI("© Meme Generator"),
              },
              gravity: "south_east",
              y: 20,
              color: "#eee",
            },
          ],
        };
      }

      console.log({ cloudinaryOptions });
      const cloudinaryImage = await cloudinary.uploader.upload(
        editedImage,
        cloudinaryOptions,
        function (error, result) {
          console.log(result, error);
          console.log({ result });
          return result;
        }
      );

      recordUpdates.push({
        id: record.id,
        fields: {
          [memeField.name]: [{ url: cloudinaryImage.secure_url }],
        },
      });
    }

    await delayAsync(50);
  }
  return recordUpdates;
}

async function updateRecordsInBatchesAsync(table, recordUpdates) {
  let i = 0;
  while (i < recordUpdates.length) {
    const updateBatch = recordUpdates.slice(i, i + MAX_RECORDS_PER_UPDATE);
    await table.updateRecordsAsync(updateBatch);
    i += MAX_RECORDS_PER_UPDATE;
  }
}

function delayAsync(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

initializeBlock(() => <MemeGeneratorBlock />);
