![](architecture.png)

The image represents the architecture of the Collaborative Document Service (CDS for short), which consists of a Hocuspocus server (microservice),
client application, routing / networking and centralized identity management.
The server handles real-time document collaboration, while the client provides the user interface for interacting with documents.

On the initial request our application proxy routes the request to Oathkeeper, which authorizes the request and forwards it to the CDS.
RabbitMQ serves as an integration point between the CDS and the collaboration server, which the CDS uses for authorization and to fetch and save documents.

For a more detailed end to end explanation, refer to the [interaction flows](interaction-flows.md) and [features](features.md) documentation.
