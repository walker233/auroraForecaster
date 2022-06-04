# auroraForecaster
Code to run on nodeJs for Alexa integration that gets the Aurora forecast.

This is intended to be setup as a lambda function in AWS, with an Alexa Skills Kit trigger.
The runtime setting is index.handler and was originally using nodejs4.3

After creating the lambda code in AWS console, you'll need to setup the Alex Skill side at the following URL.
https://developer.amazon.com/en-US/alexa/alexa-skills-kit/

From there you will need to create a skill invocation name, and at least 1 intent named GetForecastIntent that takes 5 numbers associated to zip codes. 
You will additionally have to map the Alexa Skill back to an endpoint that uses your Lambda ID for the deployed skills. 
