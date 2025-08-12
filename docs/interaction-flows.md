This document describes in detail, step by step, each of the interaction flows provided by this service

## The handshake request
1. The client makes a request to the server to initiate a handshake.
To the request are attached the cookies and a document name, represented by the UUID of the document in Alkemio.
2. The request is routed by Traefik through Oathkeeper and based on its access rules is routed to the CDS.
3. Now in the CDS boundary - a middleware is calling the collaboration server about who is the user.

   Three ways of authentication are supported:
   - Kratos cookie
   - JWT token, passed in the Authorization header
   - JWT token, passed through the `token` field, specific to the Hocuspocus authentication flow
   
If the user is not recognized, or the authentication information is somehow invalid, the middleware throws an exception
which is recognized by Hocuspocus as `access-denied`. That sends an `authenticationFailed` message to the client, which the client should handle manually.
4. If the user is authenticated, the CDS will call the collaboration server
to check the authorization of that user against the requested collaboration document.
If the document was not found, could not be read or the user does not have access to read it,
the client will receive a `authenticationFailed` message. 
5. If the document can be read by the user, CDS responds with success by sending the document to the client
and sending the `authenticated` message.
> Important: In the last step CDS will resolve the exact access of the user to that document.
> This includes the `read` and `readOnly` flags. Alongside the `readOnly` a `readOnlyCode` variable
> is calculated, which points to the reason why the flag is the value it is.
> These flags are sent to the client via the 'stateless' message.
> That can be used by the client to indicate visually to the user why was this access assigned.

## The save flow
This flow does not contain complexity but is added for completeness.

Naturally, the content has to be saved at some point. The CDS tracks all the edits, and
it sends the content to the Collaboration server to be stored after some time
of inactivity, or to avoid not saving indefinitely - after a fixed deadline.
- If the save was successful, CDS will send a `saved` event to the client via the `stateless` message.
- If the save was not successful, CDS will send a `save-error` event to the client via the `stateless` message.


The point of these messages are to inform the client about the state of the save operation,
which can be visually represented to the user.

When the session has been closed (all the clients have left the session)
and there are unsaved changes, one last save request will be sent to the collaboration server.
