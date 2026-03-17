const {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuid } = require("uuid");

const { s3 } = require("../config/s3");
const Attachment = require("../models/Attachment");
const Ticket = require("../models/Tickets");
const IdempotencyKey = require("../models/IdempotencyKey");

const uploadFile = async (req, res) => {
    let fileKey = null;
    try {

        if (!req.file)
            return res.status(400).json({ message: "No file uploaded" });

        fileKey =
            `uploads/${uuid()}-${req.file.originalname}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        });

        await s3.send(command);

        const attachment = await Attachment.create({
            fileKey,
            fileType: req.file.mimetype,
            uploadedBy: req.user?._id,
            ticket: req.body.ticketId
        });

        const response = { success: true, attachment };

        if (req.idempotencyKey) {
            await IdempotencyKey.create({
                key: req.idempotencyKey,
                response
            });
        }

        res.json(response);

    } catch (err) {
        //Compensation Strategy (can shift later to SQS Queue (I think))
        if (fileKey) {
            try {
                const deleteCommand = new DeleteObjectCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: fileKey
                });

                await s3.send(deleteCommand);
                console.log("Compensation: S3 file deleted successfully");
            } catch (deleteErr) {
                console.error("Compensation failed: Could not delete S3 object", deleteErr);
            }
        }

        console.error("s3Controller.uploadFile Error:", err);
        res.status(500).json({ message: err.message });
    }
};

const getFile = async (req, res) => {
    try {

        const attachment =
            await Attachment.findById(req.params.id);

        if (!attachment)
            return res.status(404).json({ message: "File not found" });

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: attachment.fileKey
        });

        const url = await getSignedUrl(
            s3,
            command,
            { expiresIn: 3600 }
        );

        res.json({ url });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteFile = async (req, res) => {
    try {

        const attachment =
            await Attachment.findById(req.params.id);

        if (!attachment)
            return res.status(404).json({ message: "File not found" });

        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: attachment.fileKey
        });

        await s3.send(command);

        await attachment.deleteOne();

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getFileByTicketId = async (req, res) => {
    try {
        const ticketStringId = req.params.ticketId;

        const ticketDoc = await Ticket.findOne({ issueId: ticketStringId });

        if (!ticketDoc) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        const attachment = await Attachment.findOne({ ticket: ticketDoc._id }).sort({ createdAt: -1 });

        if (!attachment) {
            return res.status(404).json({ success: false, message: "No attachment found for this ticket" });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: attachment.fileKey
        });

        const url = await getSignedUrl(
            s3,
            command,
            { expiresIn: 3600 }
        );

        res.json({ success: true, url, fileType: attachment.fileType });

    } catch (err) {
        console.error("s3Controller.getFileByTicketId Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    uploadFile,
    getFile,
    deleteFile,
    getFileByTicketId
};