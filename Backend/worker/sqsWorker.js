require("dotenv").config();

const mongoose = require("mongoose");

const {
  ReceiveMessageCommand,
  DeleteMessageCommand
} = require("@aws-sdk/client-sqs");

const sqs = require("../config/sqs");

const {
  processMessage
} = require("../controllers/sqsController");

mongoose.connect(process.env.MONGO_URI);

async function pollQueue(){

  const response = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl:process.env.SQS_QUEUE_URL,
      MaxNumberOfMessages:1,
      WaitTimeSeconds:20
    })
  );

  if(!response.Messages) return;

  for(const message of response.Messages){

    const body = JSON.parse(message.Body);

    try{

      await processMessage(body);

      await sqs.send(
        new DeleteMessageCommand({
          QueueUrl:process.env.SQS_QUEUE_URL,
          ReceiptHandle:message.ReceiptHandle
        })
      );

    }catch(err){
      console.error("Processing failed");
      // retry automatically
    }
  }
}

async function start(){
  while(true){
    await pollQueue();
  }
}

start();