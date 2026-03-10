package com.yixiao.taskmanager.ai_task_manager.mappers;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper {

    @Select("""
        INSERT INTO public.users (cognito_sub)
        VALUES (#{cognitoSub})
        ON CONFLICT (cognito_sub)
        DO UPDATE SET updated_at = now()
        RETURNING id::text
        """)
    String upsertAndGetId(@Param("cognitoSub") String cognitoSub);
}