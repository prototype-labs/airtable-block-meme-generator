import {
  initializeBlock,
  useBase,
  useRecords,
  useGlobalConfig,
  Loader,
  Button,
  Box,
  FormField,
  InputSynced,
  TablePickerSynced,
  FieldPickerSynced,
  ViewPickerSynced,
} from "@airtable/blocks/ui";
import { FieldType } from "@airtable/blocks/models";
import React, { Fragment, useState } from "react";
const url = require("url");
var cloudinary = require("cloudinary/lib/cloudinary").v2;
var removeBgApiKey, cloudinaryUrl, memeField, memeFieldId;

const MAX_RECORDS_PER_UPDATE = 50;

function MemeGeneratorBlock() {
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
    fields: [imageField, backgroundImageField],
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
      <FormField label="Image Field">
        <FieldPickerSynced
          table={table}
          globalConfigKey="imageFieldId"
          placeholder="Pick source image field"
          allowedTypes={[FieldType.MULTIPLE_ATTACHMENTS]}
        />
      </FormField>

      <FormField label="Meme Field">
        <FieldPickerSynced
          table={table}
          globalConfigKey="memeFieldId"
          placeholder="Pick the field for Meme"
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
          >
            Update Images
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
  records,
  removeBgApiKey
) {
  const recordUpdates = [];
  for (const record of records) {
    const imageAttachmentCellValue = record.getCellValue(imageField);
    const backgroundImageAttachmentCellValue = record.getCellValue(
      backgroundImageField
    );

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

      const cloudinaryOptions = {
        crop: "pad",
        overlay: {
          font_family: "Arial",
          font_size: 20,
          font_weight: "bold",
          text: "ITS%20FINE",
        },
        gravity: "south_east",
        x: 20,
        y: 20,
        color: "#eee",
      };

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
