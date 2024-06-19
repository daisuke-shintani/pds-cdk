apiIds=$(aws apigateway get-rest-apis --query "items[].id" | tr -d '"|[|]|,')
for apiId in $apiIds; do

    resourceId=$(aws apigateway get-resources \
        --rest-api-id $apiId \
        --query "items[?resourceMethods].id" \
        --output text)
    
    path=$(aws apigateway get-resources \
        --rest-api-id $apiId \
        --query "items[?contains(path, '/streams/records/')].path" \
        --output text)

    if [ -z "$path" ]; then
        continue
    fi

    response=$(aws apigateway test-invoke-method \
        --rest-api-id $apiId \
        --resource-id $resourceId \
        --http-method POST \
        --path-with-query-string $path \
        --body '{"records":[{"data":"hoge","partition-key": "hoge"},{"data":"fuga","partition-key": "fuga"}]}')
    echo $response
    
    if [ $response.status = "200" ]; then
        echo "API Gateway test failed, apiId=$apiId"
        exit 1
    fi
done